// Lazy WebR (R compiled to WebAssembly) runtime for the Analysis Studio code lane.
//
// WebR is heavy (~tens of MB of WASM) so it is dynamically imported and
// initialised only on first use — a user who never opens the code lane never
// pays for it. The R session runs entirely in the browser: the dataset is
// written to WebR's virtual filesystem and read into a data frame `df`, so the
// data never leaves the client.

import type { WebR as WebRType, Shelter as ShelterType } from 'webr'
import type { DataRow } from './types'

let webRPromise: Promise<WebRType> | null = null

/** Initialise (once) and return the shared WebR instance. */
async function getWebR(): Promise<WebRType> {
  if (!webRPromise) {
    webRPromise = (async () => {
      const { WebR } = await import('webr')
      const webR = new WebR()
      await webR.init()
      return webR
    })()
  }
  return webRPromise
}

/** True once the runtime has been requested at least once this session. */
export function isWebRStarted(): boolean {
  return webRPromise !== null
}

export interface RRunResult {
  /** Combined stdout + stderr text, in execution order. */
  output: string
  /** Plots captured from the R graphics device. */
  images: ImageBitmap[]
  /** R error message if the run failed, else null. */
  error: string | null
}

// ── CSV serialisation ─────────────────────────────────────────────────────────
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return 'NA'
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCSV(data: DataRow[]): string {
  if (data.length === 0) return ''
  const headers = Object.keys(data[0])
  const lines = [headers.map(csvCell).join(',')]
  for (const row of data) lines.push(headers.map(h => csvCell(row[h])).join(','))
  return lines.join('\n')
}

const DATA_PATH = '/tmp/plexus_data.csv'

/**
 * Run user R code against the current dataset. The dataset is exposed as a data
 * frame named `df`. Console output and any plots are captured and returned;
 * R errors are returned as `error` rather than thrown.
 */
export async function runR(code: string, data: DataRow[]): Promise<RRunResult> {
  let shelter: ShelterType | null = null
  try {
    const webR = await getWebR()
    await webR.FS.writeFile(DATA_PATH, new TextEncoder().encode(toCSV(data)))

    shelter = await new webR.Shelter()
    const preamble = `df <- read.csv(${JSON.stringify(DATA_PATH)}, stringsAsFactors = TRUE)\n`
    const capture = await shelter.captureR(preamble + code, {
      withAutoprint: true,
      captureStreams: true,
      captureConditions: false,
      captureGraphics: { width: 1008, height: 600 },
    })

    const output = capture.output
      .map(o => (typeof o.data === 'string' ? o.data : String(o.data)))
      .join('\n')

    return { output, images: capture.images, error: null }
  } catch (e) {
    return { output: '', images: [], error: e instanceof Error ? e.message : String(e) }
  } finally {
    if (shelter) await shelter.purge()
  }
}

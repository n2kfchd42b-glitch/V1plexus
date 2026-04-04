/**
 * Client-side analysis execution using Pyodide (Python) and WebR (R)
 * Both run via WebAssembly in the browser.
 */

export interface ExecutionResult {
  log: string
  tables: { title: string; headers: string[]; rows: (string | number | null)[][] }[]
  figures: { title: string; dataUrl: string }[]
  error: string | null
  durationMs: number
}

// ─── Python via Pyodide ──────────────────────────────────────────────────────

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pyodide?: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loadPyodide?: (config: Record<string, unknown>) => Promise<any>
  }
}

async function loadPyodideOnce() {
  if (window.pyodide) return window.pyodide
  if (!window.loadPyodide) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js'
      script.integrity = 'sha256-OxhgQ+7lMvxYbqG1KkvetnhEd3qEzugXOLmLrHsR8Ho='
      script.crossOrigin = 'anonymous'
      script.onload = () => resolve()
      script.onerror = reject
      document.head.appendChild(script)
    })
  }
  window.pyodide = await window.loadPyodide!({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/' })
  return window.pyodide
}

export async function runPython(
  script: string,
  csvData?: string
): Promise<ExecutionResult> {
  const start = Date.now()
  const logs: string[] = []
  const tables: ExecutionResult['tables'] = []
  const figures: ExecutionResult['figures'] = []

  try {
    const pyodide = await loadPyodideOnce()

    // Redirect stdout/stderr
    await pyodide.runPythonAsync(`
import sys, io
_stdout_capture = io.StringIO()
sys.stdout = _stdout_capture
sys.stderr = _stdout_capture
`)

    // Install micropip packages if needed
    const needsPandas = /import pandas|from pandas/.test(script)
    const needsNumpy = /import numpy|from numpy/.test(script)
    const needsMatplotlib = /import matplotlib|from matplotlib/.test(script)

    if (needsPandas || needsNumpy || needsMatplotlib) {
      await pyodide.loadPackage(['micropip'])
      if (needsNumpy) await pyodide.runPythonAsync("import micropip; await micropip.install('numpy')")
      if (needsPandas) await pyodide.runPythonAsync("import micropip; await micropip.install('pandas')")
      if (needsMatplotlib) await pyodide.runPythonAsync("import micropip; await micropip.install('matplotlib')")
    }

    // Inject CSV data as a string
    if (csvData) {
      pyodide.globals.set('_csv_data', csvData)
      await pyodide.runPythonAsync(`
import io as _io
_plexus_csv = _io.StringIO(_csv_data)
`)
    }

    // Inject helper to capture DataFrame as table
    await pyodide.runPythonAsync(`
_plexus_tables = []
_plexus_figures = []

def _show_table(df, title=""):
    try:
        import pandas as pd
        if isinstance(df, pd.DataFrame):
            _plexus_tables.append({
                "title": title,
                "headers": list(df.columns),
                "rows": df.values.tolist()
            })
    except Exception:
        pass

def show(df, title=""):
    _show_table(df, title)
`)

    // Run user script
    await pyodide.runPythonAsync(script)

    // Capture output
    const stdout = await pyodide.runPythonAsync('_stdout_capture.getvalue()')
    if (stdout) logs.push(stdout)

    // Capture tables
    const rawTables = await pyodide.runPythonAsync('_plexus_tables')
    if (rawTables) {
      const converted = rawTables.toJs({ dict_converter: Object.fromEntries })
      if (Array.isArray(converted)) {
        for (const t of converted) {
          tables.push({
            title: t.title ?? '',
            headers: t.headers ?? [],
            rows: t.rows ?? [],
          })
        }
      }
    }

    return { log: logs.join('\n'), tables, figures, error: null, durationMs: Date.now() - start }
  } catch (err) {
    return {
      log: logs.join('\n'),
      tables,
      figures,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    }
  }
}

// ─── R via WebR ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let webrInstance: any = null

async function loadWebROnce() {
  if (webrInstance) return webrInstance

  // Load WebR from CDN via script tag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = globalThis as any
  if (!w.WebR) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.type = 'module'
      // Pin to a specific version rather than 'latest' to reduce CDN compromise surface
      // TODO: Add importmap SRI once browser support is widespread enough
      script.textContent = `
        import { WebR } from 'https://webr.r-wasm.org/v0.4.2/webr.mjs';
        globalThis.WebR = WebR;
        globalThis._webrLoaded = true;
        window.dispatchEvent(new Event('webr-loaded'));
      `
      script.onerror = reject
      document.head.appendChild(script)
    })
    await new Promise<void>(resolve => {
      if (w._webrLoaded) { resolve(); return }
      window.addEventListener('webr-loaded', () => resolve(), { once: true })
    })
  }

  const webr = new w.WebR()
  await webr.init()
  webrInstance = webr
  return webr
}

export async function runR(
  script: string,
  csvData?: string
): Promise<ExecutionResult> {
  const start = Date.now()
  const logs: string[] = []
  const tables: ExecutionResult['tables'] = []
  const figures: ExecutionResult['figures'] = []

  try {
    const webr = await loadWebROnce()

    // Inject CSV data
    const preamble = csvData
      ? `plexus_data <- read.csv(text=${JSON.stringify(csvData)})\n`
      : ''

    const shelter = await webr.Shelter.new()
    try {
      const result = await shelter.captureR(preamble + script, {
        captureStreams: true,
        captureConditions: false,
      })

      for (const out of result.output ?? []) {
        if (out.type === 'stdout' || out.type === 'stderr') {
          logs.push(out.data)
        }
      }

      // Try to extract data frames from result
      if (result.result) {
        try {
          const df = await result.result.toJs()
          if (df && typeof df === 'object' && !Array.isArray(df)) {
            const headers = Object.keys(df)
            if (headers.length > 0) {
              const colArrays = Object.values(df) as unknown[][]
              const rowCount = (colArrays[0] as unknown[]).length
              const rows: (string | number | null)[][] = []
              for (let i = 0; i < Math.min(rowCount, 1000); i++) {
                rows.push(colArrays.map(col => {
                  const v = (col as (string | number | null)[])[i]
                  return v ?? null
                }))
              }
              tables.push({ title: 'Result', headers, rows })
            }
          }
        } catch {
          // not a data frame, that's fine
        }
      }
    } finally {
      shelter.purge()
    }

    return { log: logs.join('\n'), tables, figures, error: null, durationMs: Date.now() - start }
  } catch (err) {
    return {
      log: logs.join('\n'),
      tables,
      figures,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    }
  }
}

export async function runScript(
  engine: 'r' | 'python',
  script: string,
  csvData?: string
): Promise<ExecutionResult> {
  if (engine === 'python') return runPython(script, csvData)
  return runR(script, csvData)
}

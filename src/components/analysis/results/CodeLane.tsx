"use client"

import { useState } from 'react'
import { Play } from 'lucide-react'
import { CodeEditor } from '../CodeEditor'
import { runR, isWebRStarted, type RRunResult } from '@/lib/analysis/webRuntime'
import type { DataRow } from '@/lib/analysis/types'

interface Props {
  data: DataRow[]
  onComplete: (source: string, res: RRunResult) => void
}

const DEFAULT_CODE = `# Your dataset is available as the data frame 'df'.
summary(df)
`

export function CodeLane({ data, onComplete }: Props) {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [running, setRunning] = useState(false)
  const [booting, setBooting] = useState(false)

  const run = async () => {
    if (running || !code.trim()) return
    setRunning(true)
    setBooting(!isWebRStarted()) // first run downloads the R runtime
    const res = await runR(code, data)
    setBooting(false)
    setRunning(false)
    onComplete(code, res)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden px-4 py-4 gap-3">
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        <p className="subsection-label">R · dataset available as <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>df</span></p>
        <span className="data-mono-xs" style={{ color: 'var(--text-tertiary)' }}>{data.length.toLocaleString()} rows</span>
      </div>

      <div className="flex-1 min-h-[180px] overflow-hidden rounded-md">
        <CodeEditor value={code} onChange={setCode} language="r" disabled={running} className="h-full" />
      </div>

      <button
        onClick={run}
        disabled={running || !code.trim()}
        className="flex-shrink-0 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
        style={{ background: 'linear-gradient(135deg,var(--color-clinical-deep),var(--color-clinical-blue))' }}
      >
        {running ? (
          <>
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            {booting ? 'Starting R runtime…' : 'Running…'}
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5" />
            Run R
          </>
        )}
      </button>

      <p className="text-[11px] leading-relaxed flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
        {booting
          ? 'First run downloads the R runtime (tens of MB) — this happens once per session. Everything runs in your browser; data never leaves this device.'
          : 'Output and plots land on the results canvas below. Runs in-browser via WebR.'}
      </p>
    </div>
  )
}

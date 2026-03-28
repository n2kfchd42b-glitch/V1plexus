"use client"

import { ComposedChart, XAxis, YAxis, Scatter, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'
import type { ScatterShapeProps } from 'recharts'
import { BarChart2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface ForestRow {
  name: string
  value: number
  ciLow: number
  ciHigh: number
  p: string
}

interface LatestAnalysisCardsProps {
  projectId: string
  runTitle: string | null
  runId: string
  analysisType: string
  forestRows: ForestRow[]
  plainLanguage: string | null
  interpretation: string | null
}

function MiniForestPlot({ rows }: { rows: ForestRow[] }) {
  if (!rows || rows.length === 0) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-blue-200/40 text-xs">No chart data</p>
    </div>
  )

  const display = rows.slice(0, 6)
  const data = display.map((r, i) => ({
    y: i,
    x: r.value,
    errorX: [[r.value - r.ciLow], [r.ciHigh - r.value]],
    name: r.name,
    p: r.p,
  }))

  const allVals = display.flatMap(r => [r.ciLow, r.ciHigh, r.value])
  const min = Math.min(...allVals)
  const max = Math.max(...allVals)
  const pad = (max - min) * 0.15

  return (
    <div className="flex gap-3 h-full">
      {/* Labels */}
      <div className="flex flex-col justify-around py-1 flex-shrink-0" style={{ height: 160 }}>
        {display.map((r) => (
          <span key={r.name} className="text-[9px] text-blue-200/60 truncate max-w-[72px] leading-none font-medium">
            {r.name.length > 10 ? r.name.slice(0, 10) + '…' : r.name}
          </span>
        ))}
      </div>
      {/* Chart */}
      <div className="flex-1" style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 4, bottom: 4, left: 0 }}
          >
            <XAxis
              type="number"
              domain={[min - pad, max + pad]}
              tick={{ fontSize: 8, fill: 'rgba(147,197,253,0.4)' }}
              axisLine={false}
              tickLine={false}
              tickCount={4}
            />
            <YAxis type="number" domain={[-0.5, display.length - 0.5]} hide />
            <ReferenceLine x={1} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload
                return (
                  <div className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-[9px]">
                    <p className="text-white font-semibold mb-0.5">{d.name}</p>
                    <p className="text-blue-200">OR: {d.x?.toFixed(2)} · p={d.p}</p>
                  </div>
                )
              }}
            />
            <Scatter
              dataKey="x"
              fill="#60a5fa"
              r={4}
              shape={(props: ScatterShapeProps) => {
                const { cx = 0, cy = 0, payload, xAxis } = props as ScatterShapeProps & { payload: typeof data[0]; xAxis?: { scale?: (v: number) => number } }
                const scale = xAxis?.scale
                if (!scale) return <circle cx={cx} cy={cy} r={4} fill="#60a5fa" />
                const lo = scale((payload.x ?? 0) - (payload.errorX?.[0]?.[0] ?? 0))
                const hi = scale((payload.x ?? 0) + (payload.errorX?.[1]?.[0] ?? 0))
                return (
                  <g>
                    <line x1={lo} x2={hi} y1={cy} y2={cy} stroke="rgba(96,165,250,0.5)" strokeWidth={1.5} />
                    <line x1={lo} x2={lo} y1={cy - 3} y2={cy + 3} stroke="rgba(96,165,250,0.4)" strokeWidth={1} />
                    <line x1={hi} x2={hi} y1={cy - 3} y2={cy + 3} stroke="rgba(96,165,250,0.4)" strokeWidth={1} />
                    <circle cx={cx} cy={cy} r={3.5} fill="#3b82f6" stroke="#93c5fd" strokeWidth={1} />
                  </g>
                )
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function LatestAnalysisCards({
  projectId,
  runTitle,
  runId,
  analysisType,
  forestRows,
  plainLanguage,
  interpretation,
}: LatestAnalysisCardsProps) {
  const text = plainLanguage || interpretation || 'No summary available for this analysis.'
  const hasForest = forestRows && forestRows.length > 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

      {/* Left — Mini Forest Plot */}
      <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-[0_20px_50px_rgba(0,24,72,0.12)] group">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-48 h-32 bg-blue-600/10 blur-[60px] rounded-full" />
          <div className="absolute bottom-0 right-1/4 w-32 h-24 bg-indigo-500/10 blur-[40px] rounded-full" />
        </div>

        <div className="relative z-10 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[9px] font-bold text-blue-300/50 uppercase tracking-widest mb-1">Latest Analysis</p>
              <h3 className="text-sm font-bold text-white font-manrope leading-snug line-clamp-1">
                {runTitle || analysisType}
              </h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
              <BarChart2 className="h-3.5 w-3.5 text-blue-400" />
            </div>
          </div>

          {hasForest ? (
            <MiniForestPlot rows={forestRows} />
          ) : (
            <div className="h-[160px] flex items-center justify-center">
              <p className="text-blue-200/30 text-xs text-center">Run an analysis to see results here</p>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-[9px] font-bold text-blue-300/40 uppercase tracking-widest">
              {analysisType.replace(/_/g, ' ')}
            </span>
            <Link
              href={`/projects/${projectId}/analysis/${runId}`}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-400 hover:text-blue-300 transition-colors group/link"
            >
              View full results
              <ArrowRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* Right — Plain Language Summary */}
      <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-[0_20px_50px_rgba(0,24,72,0.12)] group">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-48 h-32 bg-indigo-600/10 blur-[60px] rounded-full" />
          <div className="absolute bottom-0 left-1/4 w-32 h-24 bg-blue-500/8 blur-[40px] rounded-full" />
        </div>

        <div className="relative z-10 p-6 flex flex-col h-full">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[9px] font-bold text-blue-300/50 uppercase tracking-widest mb-1">Plain Language Summary</p>
              <h3 className="text-sm font-bold text-white font-manrope">Key Findings</h3>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[9px] text-green-400/70 font-semibold">Complete</span>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <p className="text-sm text-blue-100/70 leading-relaxed line-clamp-[8]">
              {text}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-[9px] font-bold text-blue-300/40 uppercase tracking-widest">
              AI Interpretation
            </span>
            <Link
              href={`/projects/${projectId}/analysis`}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-400 hover:text-blue-300 transition-colors group/link"
            >
              Analysis hub
              <ArrowRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

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

// ── Pure-SVG mini forest plot ────────────────────────────────────
function MiniForestPlot({ rows }: { rows: ForestRow[] }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px]">
        <p className="text-blue-200/30 text-xs">No chart data</p>
      </div>
    )
  }

  const display = rows.slice(0, 7)
  const ROW_H = 24
  const LABEL_W = 88
  const PAD_R = 12
  const PAD_T = 8
  const PAD_B = 20 // room for x-axis ticks
  const W = 340
  const plotW = W - LABEL_W - PAD_R
  const H = PAD_T + display.length * ROW_H + PAD_B

  // domain
  const allVals = display.flatMap(r => [r.ciLow, r.ciHigh, r.value]).filter(v => isFinite(v))
  if (allVals.length === 0) return null
  const rawMin = Math.min(...allVals)
  const rawMax = Math.max(...allVals)
  const pad = Math.max((rawMax - rawMin) * 0.18, 0.3)
  const domMin = rawMin - pad
  const domMax = rawMax + pad

  const xScale = (v: number) => LABEL_W + ((v - domMin) / (domMax - domMin)) * plotW

  // reference line position (1 for ratios, 0 for coefficients)
  const isRatio = display.some(r => r.value > 0.5 && r.ciLow > 0)
  const refVal = isRatio ? 1 : 0
  const refX = xScale(refVal)

  // x-axis ticks
  const tickCount = 4
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const v = domMin + (i / (tickCount - 1)) * (domMax - domMin)
    return { v, x: xScale(v) }
  })

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      overflow="visible"
      style={{ display: 'block' }}
    >
      {/* Reference line */}
      {refX >= LABEL_W && refX <= W - PAD_R && (
        <line
          x1={refX} y1={PAD_T - 4}
          x2={refX} y2={H - PAD_B + 4}
          stroke="rgba(0,61,155,0.2)"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
      )}

      {/* Plot background strip — alternating row tints */}
      {display.map((_, i) => i % 2 === 0 ? (
        <rect
          key={i}
          x={LABEL_W} y={PAD_T + i * ROW_H}
          width={plotW} height={ROW_H}
          fill="rgba(241,245,249,0.7)"
        />
      ) : null)}

      {/* Rows */}
      {display.map((r, i) => {
        const cy = PAD_T + i * ROW_H + ROW_H / 2
        const cx = xScale(r.value)
        const loX = xScale(Math.max(r.ciLow, domMin))
        const hiX = xScale(Math.min(r.ciHigh, domMax))
        const sig = parseFloat(r.p) < 0.05

        return (
          <g key={r.name}>
            {/* Label */}
            <text
              x={LABEL_W - 6}
              y={cy + 1}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={9}
              fill={sig ? '#1e3a5f' : '#6b7280'}
              fontFamily="Inter, sans-serif"
              fontWeight={sig ? '600' : '400'}
            >
              {r.name.length > 12 ? r.name.slice(0, 12) + '…' : r.name}
            </text>

            {/* CI line */}
            {loX < hiX && (
              <line
                x1={loX} y1={cy}
                x2={hiX} y2={cy}
                stroke={sig ? 'rgba(37,99,235,0.5)' : 'rgba(156,163,175,0.6)'}
                strokeWidth={1.5}
              />
            )}

            {/* CI whiskers */}
            {loX >= LABEL_W && (
              <line x1={loX} y1={cy - 3.5} x2={loX} y2={cy + 3.5}
                stroke={sig ? 'rgba(37,99,235,0.45)' : 'rgba(156,163,175,0.5)'}
                strokeWidth={1} />
            )}
            {hiX <= W - PAD_R && (
              <line x1={hiX} y1={cy - 3.5} x2={hiX} y2={cy + 3.5}
                stroke={sig ? 'rgba(37,99,235,0.45)' : 'rgba(156,163,175,0.5)'}
                strokeWidth={1} />
            )}

            {/* Point estimate */}
            {cx >= LABEL_W && cx <= W - PAD_R && (
              sig ? (
                <polygon
                  points={`${cx},${cy - 5} ${cx + 4.5},${cy} ${cx},${cy + 5} ${cx - 4.5},${cy}`}
                  fill="#2563eb"
                  stroke="#bfdbfe"
                  strokeWidth={0.8}
                />
              ) : (
                <circle
                  cx={cx} cy={cy} r={3.5}
                  fill="rgba(37,99,235,0.12)"
                  stroke="#93c5fd"
                  strokeWidth={1}
                />
              )
            )}
          </g>
        )
      })}

      {/* X-axis ticks */}
      {ticks.map(({ v, x }) => (
        <g key={v}>
          <line x1={x} y1={H - PAD_B + 2} x2={x} y2={H - PAD_B + 5}
            stroke="#d1d5db" strokeWidth={1} />
          <text
            x={x} y={H - PAD_B + 12}
            textAnchor="middle"
            fontSize={7.5}
            fill="#9ca3af"
            fontFamily="Inter, sans-serif"
          >
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* Legend */}
      <g transform={`translate(${LABEL_W}, ${H - 6})`}>
        <polygon points="0,-4 3.5,0 0,4 -3.5,0" fill="#2563eb" />
        <text x={7} y={1} fontSize={7} fill="#9ca3af" dominantBaseline="middle" fontFamily="Inter, sans-serif">
          significant
        </text>
        <circle cx={60} cy={0} r={3.5} fill="rgba(37,99,235,0.15)" stroke="#93c5fd" strokeWidth={1} />
        <text x={67} y={1} fontSize={7} fill="#9ca3af" dominantBaseline="middle" fontFamily="Inter, sans-serif">
          non-significant
        </text>
      </g>
    </svg>
  )
}

// ── Main export ──────────────────────────────────────────────────
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
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#191c1e] font-manrope">
            Latest Analysis
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Results and plain language summary from the most recent run
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/analysis`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#003d9b] hover:underline"
        >
          View all analyses
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Left — SVG Forest Plot (light card) */}
        <div className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <div className="p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Forest Plot
                </p>
                <h3 className="text-sm font-bold text-[#191c1e] font-manrope leading-snug line-clamp-1">
                  {runTitle || analysisType}
                </h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                <BarChart2 className="h-3.5 w-3.5 text-[#003d9b]" />
              </div>
            </div>

            <div className="w-full overflow-hidden">
              {hasForest ? (
                <MiniForestPlot rows={forestRows} />
              ) : (
                <div className="h-[180px] flex items-center justify-center">
                  <p className="text-slate-300 text-xs text-center">
                    No forest plot data available
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                {analysisType.replace(/_/g, ' ')}
              </span>
              <Link
                href={`/projects/${projectId}/analysis/${runId}`}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#003d9b] hover:text-[#0052cc] transition-colors group/link"
              >
                View full results
                <ArrowRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right — Plain Language Summary */}
        <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-[0_20px_50px_rgba(0,24,72,0.12)]">
          {/* Ambient glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-1/4 w-48 h-32 bg-indigo-600/8 blur-[70px] rounded-full" />
            <div className="absolute bottom-0 left-1/4 w-40 h-28 bg-blue-500/6 blur-[50px] rounded-full" />
          </div>

          <div className="relative z-10 p-6 flex flex-col" style={{ minHeight: 280 }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[9px] font-bold text-blue-300/50 uppercase tracking-widest mb-1">
                  Plain Language Summary
                </p>
                <h3 className="text-sm font-bold text-white font-manrope">Key Findings</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[9px] text-green-400/70 font-semibold uppercase tracking-wider">
                  Complete
                </span>
              </div>
            </div>

            <div className="flex-1">
              <p className="text-sm text-blue-100/65 leading-relaxed">
                {text}
              </p>
            </div>

            <div className="mt-6 pt-3 border-t border-white/5 flex items-center justify-between">
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
    </div>
  )
}

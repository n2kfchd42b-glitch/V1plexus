"use client"

import { BarChart2, ArrowRight, Activity } from 'lucide-react'
import Link from 'next/link'

interface ForestRow {
  name: string
  value: number
  ciLow: number
  ciHigh: number
  p: string
}

interface KMPoint {
  time: number
  survival: number
  ciLow: number
  ciHigh: number
  group: string
}

interface LatestAnalysisCardsProps {
  projectId: string
  runTitle: string | null
  runId: string
  analysisType: string
  forestRows: ForestRow[]
  kmData: KMPoint[]
  kmGroups: string[]
  plainLanguage: string | null
  interpretation: string | null
}

// ── Pure-SVG mini forest plot ────────────────────────────────────
function MiniForestPlot({ rows }: { rows: ForestRow[] }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <p className="text-slate-300 text-xs">No chart data</p>
      </div>
    )
  }

  const display = rows.slice(0, 8)
  const ROW_H = 34
  const LABEL_W = 100
  const PAD_R = 16
  const PAD_T = 10
  const PAD_B = 26
  const W = 480
  const plotW = W - LABEL_W - PAD_R
  const H = PAD_T + display.length * ROW_H + PAD_B

  // ── Domain based on POINT ESTIMATES only to prevent outlier CIs
  //    blowing out the scale. Extreme CIs are clipped and shown with arrows.
  const estimates = display.map(r => r.value).filter(v => isFinite(v) && !isNaN(v))
  if (estimates.length === 0) return null
  const estMin = Math.min(...estimates)
  const estMax = Math.max(...estimates)
  const estRange = Math.max(estMax - estMin, 0.5)
  const domMin = estMin - estRange * 0.45
  const domMax = estMax + estRange * 0.45

  const xScale = (v: number) =>
    LABEL_W + ((v - domMin) / (domMax - domMin)) * plotW

  const isRatio = display.some(r => r.value > 0 && r.ciLow > 0)
  const refVal = isRatio ? 1 : 0
  const refX = xScale(refVal)

  // 5 evenly-spaced ticks across the visible domain
  const ticks = Array.from({ length: 5 }, (_, i) => {
    const v = domMin + (i / 4) * (domMax - domMin)
    return { v, x: xScale(v) }
  })

  const fmt = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1000) return v.toExponential(1)
    if (abs >= 10)   return v.toFixed(1)
    return v.toFixed(2)
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
    >
      {/* Alternating row fills */}
      {display.map((_, i) =>
        i % 2 === 0 ? (
          <rect
            key={i}
            x={LABEL_W} y={PAD_T + i * ROW_H}
            width={plotW} height={ROW_H}
            fill="rgba(241,245,249,0.8)"
          />
        ) : null
      )}

      {/* Reference line */}
      {refX >= LABEL_W && refX <= W - PAD_R && (
        <line
          x1={refX} y1={PAD_T}
          x2={refX} y2={H - PAD_B + 4}
          stroke="rgba(0,61,155,0.25)"
          strokeDasharray="4 3"
          strokeWidth={1.2}
        />
      )}

      {/* Rows */}
      {display.map((r, i) => {
        const cy = PAD_T + i * ROW_H + ROW_H / 2
        const cx  = xScale(r.value)
        const sig = parseFloat(r.p) < 0.05

        // Clamp CI to visible domain; track if clipped
        const rawLoX = xScale(r.ciLow)
        const rawHiX = xScale(r.ciHigh)
        const loX    = Math.max(rawLoX, LABEL_W + 1)
        const hiX    = Math.min(rawHiX, W - PAD_R - 1)
        const clippedLeft  = rawLoX < LABEL_W + 1
        const clippedRight = rawHiX > W - PAD_R - 1

        const ciColor     = sig ? 'rgba(29,78,216,0.65)'  : 'rgba(156,163,175,0.7)'
        const whiskerColor = sig ? 'rgba(29,78,216,0.55)' : 'rgba(156,163,175,0.6)'

        return (
          <g key={r.name}>
            {/* Row label */}
            <text
              x={LABEL_W - 8}
              y={cy}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill={sig ? '#1e3a5f' : '#6b7280'}
              fontFamily="Inter, sans-serif"
              fontWeight={sig ? '600' : '400'}
            >
              {r.name.length > 13 ? r.name.slice(0, 13) + '…' : r.name}
            </text>

            {/* CI line */}
            {loX < hiX && (
              <line
                x1={loX} y1={cy}
                x2={hiX} y2={cy}
                stroke={ciColor}
                strokeWidth={2}
              />
            )}

            {/* Left whisker or clipped arrow */}
            {clippedLeft ? (
              <polygon
                points={`${LABEL_W + 6},${cy - 5} ${LABEL_W + 1},${cy} ${LABEL_W + 6},${cy + 5}`}
                fill={ciColor}
              />
            ) : (
              <line x1={loX} y1={cy - 5} x2={loX} y2={cy + 5}
                stroke={whiskerColor} strokeWidth={1.8} strokeLinecap="round" />
            )}

            {/* Right whisker or clipped arrow */}
            {clippedRight ? (
              <polygon
                points={`${W - PAD_R - 6},${cy - 5} ${W - PAD_R - 1},${cy} ${W - PAD_R - 6},${cy + 5}`}
                fill={ciColor}
              />
            ) : (
              <line x1={hiX} y1={cy - 5} x2={hiX} y2={cy + 5}
                stroke={whiskerColor} strokeWidth={1.8} strokeLinecap="round" />
            )}

            {/* Point estimate */}
            {cx >= LABEL_W && cx <= W - PAD_R && (
              sig ? (
                <polygon
                  points={`${cx},${cy - 6} ${cx + 5.5},${cy} ${cx},${cy + 6} ${cx - 5.5},${cy}`}
                  fill="#1d4ed8"
                  stroke="#bfdbfe"
                  strokeWidth={1}
                />
              ) : (
                <circle
                  cx={cx} cy={cy} r={4.5}
                  fill="rgba(29,78,216,0.14)"
                  stroke="#93c5fd"
                  strokeWidth={1.2}
                />
              )
            )}
          </g>
        )
      })}

      {/* X-axis baseline */}
      <line
        x1={LABEL_W} y1={H - PAD_B + 4}
        x2={W - PAD_R} y2={H - PAD_B + 4}
        stroke="#e5e7eb" strokeWidth={1}
      />

      {/* X-axis ticks + labels */}
      {ticks.map(({ v, x }) => (
        <g key={v}>
          <line
            x1={x} y1={H - PAD_B + 4}
            x2={x} y2={H - PAD_B + 8}
            stroke="#d1d5db" strokeWidth={1}
          />
          <text
            x={x} y={H - PAD_B + 18}
            textAnchor="middle"
            fontSize={8.5}
            fill="#9ca3af"
            fontFamily="Inter, sans-serif"
          >
            {fmt(v)}
          </text>
        </g>
      ))}

      {/* Legend */}
      <g transform={`translate(${LABEL_W + 4}, ${H - 6})`}>
        <polygon points="0,-4 4,0 0,4 -4,0" fill="#1d4ed8" />
        <text x={8} y={1} fontSize={7.5} fill="#9ca3af" dominantBaseline="middle" fontFamily="Inter, sans-serif">
          p &lt; 0.05
        </text>
        <circle cx={62} cy={0} r={4} fill="rgba(29,78,216,0.14)" stroke="#93c5fd" strokeWidth={1.2} />
        <text x={70} y={1} fontSize={7.5} fill="#9ca3af" dominantBaseline="middle" fontFamily="Inter, sans-serif">
          n.s.
        </text>
      </g>
    </svg>
  )
}

// ── Pure-SVG mini Kaplan-Meier curve ─────────────────────────
function MiniKMCurve({ data, groups }: { data: KMPoint[]; groups: string[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <p className="text-slate-300 text-xs">No chart data</p>
      </div>
    )
  }

  const W = 480
  const H = 220
  const PAD_L = 36
  const PAD_R = 16
  const PAD_T = 10
  const PAD_B = 30
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B

  const maxTime = Math.max(...data.map(d => d.time), 1)
  const xScale = (t: number) => PAD_L + (t / maxTime) * plotW
  const yScale = (s: number) => PAD_T + (1 - Math.min(Math.max(s, 0), 1)) * plotH

  const KM_COLORS = ['#1d4ed8', '#7c3aed', '#0891b2', '#059669']

  const getStepPath = (groupData: KMPoint[]) => {
    if (groupData.length === 0) return ''
    const sorted = [...groupData].sort((a, b) => a.time - b.time)
    let d = `M ${xScale(sorted[0].time).toFixed(1)} ${yScale(sorted[0].survival).toFixed(1)}`
    for (let i = 1; i < sorted.length; i++) {
      d += ` H ${xScale(sorted[i].time).toFixed(1)}`
      d += ` V ${yScale(sorted[i].survival).toFixed(1)}`
    }
    return d
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0]
  const xTicks = Array.from({ length: 5 }, (_, i) => (i / 4) * maxTime)
  const fmtT = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      {/* Grid lines */}
      {yTicks.map(v => (
        <line key={v} x1={PAD_L} y1={yScale(v)} x2={W - PAD_R} y2={yScale(v)}
          stroke="rgba(241,245,249,0.9)" strokeWidth={1} />
      ))}

      {/* Y-axis */}
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + plotH} stroke="#e5e7eb" strokeWidth={1} />

      {/* X-axis baseline */}
      <line x1={PAD_L} y1={PAD_T + plotH} x2={W - PAD_R} y2={PAD_T + plotH} stroke="#e5e7eb" strokeWidth={1} />

      {/* Y-axis labels */}
      {yTicks.map(v => (
        <text key={v} x={PAD_L - 5} y={yScale(v)} textAnchor="end" dominantBaseline="middle"
          fontSize={8.5} fill="#9ca3af" fontFamily="Inter, sans-serif">
          {v.toFixed(2)}
        </text>
      ))}

      {/* X-axis ticks + labels */}
      {xTicks.map(v => (
        <g key={v}>
          <line x1={xScale(v)} y1={PAD_T + plotH} x2={xScale(v)} y2={PAD_T + plotH + 4}
            stroke="#d1d5db" strokeWidth={1} />
          <text x={xScale(v)} y={PAD_T + plotH + 14} textAnchor="middle"
            fontSize={8.5} fill="#9ca3af" fontFamily="Inter, sans-serif">
            {fmtT(v)}
          </text>
        </g>
      ))}

      {/* Survival curves */}
      {groups.map((group, i) => {
        const groupData = data.filter(d => d.group === group)
        const path = getStepPath(groupData)
        if (!path) return null
        return (
          <path key={group} d={path} fill="none"
            stroke={KM_COLORS[i % KM_COLORS.length]}
            strokeWidth={2.2} strokeLinejoin="round" />
        )
      })}

      {/* Legend */}
      <g transform={`translate(${PAD_L + 4}, ${H - 6})`}>
        {groups.length === 1 ? (
          <>
            <line x1={0} y1={0} x2={14} y2={0} stroke={KM_COLORS[0]} strokeWidth={2.2} />
            <text x={18} y={1} fontSize={7.5} fill="#9ca3af" dominantBaseline="middle" fontFamily="Inter, sans-serif">
              Survival Probability
            </text>
          </>
        ) : (
          groups.slice(0, 3).map((group, i) => (
            <g key={group} transform={`translate(${i * 80}, 0)`}>
              <line x1={0} y1={0} x2={14} y2={0} stroke={KM_COLORS[i % KM_COLORS.length]} strokeWidth={2.2} />
              <text x={18} y={1} fontSize={7.5} fill="#9ca3af" dominantBaseline="middle" fontFamily="Inter, sans-serif">
                {group.length > 9 ? group.slice(0, 9) + '…' : group}
              </text>
            </g>
          ))
        )}
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
  kmData,
  kmGroups,
  plainLanguage,
  interpretation,
}: LatestAnalysisCardsProps) {
  const text = plainLanguage || interpretation || 'No summary available for this analysis.'
  const hasForest = forestRows && forestRows.length > 0
  const hasKM = !hasForest && kmData && kmData.length > 0
  const hasChart = hasForest || hasKM

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
                  {hasKM ? 'Survival Curve' : 'Forest Plot'}
                </p>
                <h3 className="text-sm font-bold text-[#191c1e] font-manrope leading-snug line-clamp-1">
                  {runTitle || analysisType}
                </h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                {hasKM
                  ? <Activity className="h-3.5 w-3.5 text-[#003d9b]" />
                  : <BarChart2 className="h-3.5 w-3.5 text-[#003d9b]" />
                }
              </div>
            </div>

            <div className="w-full overflow-hidden">
              {hasForest ? (
                <MiniForestPlot rows={forestRows} />
              ) : hasKM ? (
                <MiniKMCurve data={kmData} groups={kmGroups} />
              ) : (
                <div className="h-[180px] flex items-center justify-center">
                  <p className="text-slate-300 text-xs text-center">
                    No chart data available
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

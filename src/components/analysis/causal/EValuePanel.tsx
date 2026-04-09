'use client'

/**
 * EValuePanel — E-value number, interpretation, and bias sensitivity curve.
 * The curve plots RR(confounder→exposure) on x-axis vs the minimum
 * RR(confounder→outcome) needed to nullify the effect on y-axis.
 * The region below the curve is where the effect survives.
 */

import type { EValueResult } from '@/types/causalEstimation'

interface EValuePanelProps {
  result: EValueResult
}

const CURVE_W = 400
const CURVE_H = 220
const PAD = { top: 16, right: 16, bottom: 36, left: 44 }

export function EValuePanel({ result }: EValuePanelProps) {
  const { evalue_estimate, evalue_ci_bound, interpretation, sensitivity_curve } = result

  // Build SVG path from curve data
  const xs = sensitivity_curve.map((p) => p.rr_confounder_exposure)
  const ys = sensitivity_curve.map((p) => p.rr_confounder_outcome_needed)
  const minX = Math.min(...xs, 1)
  const maxX = Math.max(...xs, 3)
  const minY = 1
  const maxY = Math.max(...ys, 3)

  const plotW = CURVE_W - PAD.left - PAD.right
  const plotH = CURVE_H - PAD.top - PAD.bottom

  const toSvgX = (v: number) => PAD.left + ((v - minX) / (maxX - minX)) * plotW
  const toSvgY = (v: number) => PAD.top + plotH - ((v - minY) / (maxY - minY)) * plotH

  const pathD = sensitivity_curve
    .map((p, i) => {
      const x = toSvgX(p.rr_confounder_exposure)
      const y = toSvgY(p.rr_confounder_outcome_needed)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  // Fill below curve (safe zone)
  const fillPath = pathD
    + ` L${toSvgX(maxX).toFixed(1)},${(PAD.top + plotH).toFixed(1)}`
    + ` L${toSvgX(minX).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`

  // Axis ticks
  const xTicks = [1, 2, 3, 4].filter((t) => t <= maxX + 0.5)
  const yTicks = [1, 2, 3, 4].filter((t) => t <= maxY + 0.5)

  const robustness = evalue_estimate >= 2.5 ? 'Robust' : evalue_estimate >= 1.5 ? 'Moderate' : 'Fragile'
  const robustColor = evalue_estimate >= 2.5 ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
    : evalue_estimate >= 1.5 ? 'text-amber-700 bg-amber-50 border-amber-100'
    : 'text-red-700 bg-red-50 border-red-100'

  return (
    <div className="space-y-4 text-sm">
      {/* Top row: E-value numbers */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
            E-value (point estimate)
          </p>
          <p className="text-3xl font-mono font-semibold text-gray-900">
            {evalue_estimate.toFixed(2)}
          </p>
          <span className={`mt-2 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${robustColor}`}>
            {robustness}
          </span>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
            E-value (CI bound)
          </p>
          <p className="text-3xl font-mono font-semibold text-gray-900">
            {evalue_ci_bound.toFixed(2)}
          </p>
          <p className="text-[10px] text-gray-400 mt-2">To shift CI to null</p>
        </div>
      </div>

      {/* Sensitivity curve */}
      {sensitivity_curve.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Bias sensitivity curve
          </p>
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 overflow-x-auto">
            <svg width={CURVE_W} height={CURVE_H} className="overflow-visible">
              {/* Safe zone fill */}
              <path d={fillPath} fill="#10B981" fillOpacity={0.08} />

              {/* Curve line */}
              <path d={pathD} fill="none" stroke="#6366F1" strokeWidth={2} strokeLinecap="round" />

              {/* E-value vertical line */}
              <line
                x1={toSvgX(evalue_estimate)} y1={PAD.top}
                x2={toSvgX(evalue_estimate)} y2={PAD.top + plotH}
                stroke="#6366F1" strokeWidth={1} strokeDasharray="4 2" opacity={0.5}
              />

              {/* Axes */}
              <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH}
                stroke="#E5E7EB" strokeWidth={1} />
              <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH}
                stroke="#E5E7EB" strokeWidth={1} />

              {/* X ticks */}
              {xTicks.map((t) => (
                <g key={`x${t}`}>
                  <line x1={toSvgX(t)} y1={PAD.top + plotH} x2={toSvgX(t)} y2={PAD.top + plotH + 4}
                    stroke="#D1D5DB" strokeWidth={1} />
                  <text x={toSvgX(t)} y={PAD.top + plotH + 14} textAnchor="middle"
                    fontSize={9} fill="#9CA3AF">{t}</text>
                </g>
              ))}

              {/* Y ticks */}
              {yTicks.map((t) => (
                <g key={`y${t}`}>
                  <line x1={PAD.left - 4} y1={toSvgY(t)} x2={PAD.left} y2={toSvgY(t)}
                    stroke="#D1D5DB" strokeWidth={1} />
                  <text x={PAD.left - 7} y={toSvgY(t) + 3} textAnchor="end"
                    fontSize={9} fill="#9CA3AF">{t}</text>
                </g>
              ))}

              {/* Axis labels */}
              <text x={PAD.left + plotW / 2} y={CURVE_H - 2} textAnchor="middle"
                fontSize={9} fill="#9CA3AF">RR confounder–exposure</text>
              <text x={10} y={PAD.top + plotH / 2} textAnchor="middle"
                fontSize={9} fill="#9CA3AF"
                transform={`rotate(-90, 10, ${PAD.top + plotH / 2})`}>
                RR confounder–outcome needed
              </text>
            </svg>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            Region below the curve: effect survives. Dashed line = E-value ({evalue_estimate.toFixed(2)}).
          </p>
        </div>
      )}

      {/* Interpretation */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-800 leading-relaxed">
        {interpretation}
      </div>
    </div>
  )
}

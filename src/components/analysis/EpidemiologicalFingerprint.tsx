'use client'

/**
 * Epidemiological Fingerprint — PLEXUS signature composite chart.
 *
 * Renders a radar/spider chart using pure SVG (no extra dependencies).
 * Dimensions: completeness, distribution quality, sample adequacy,
 * covariate balance, temporal consistency, outcome prevalence.
 *
 * Accepts a DataPortrait to compute dimensions automatically,
 * or raw dimension scores.
 */

import type { DataPortrait } from '@/types/analyticsIntelligence'

interface FingerprintDimension {
  label: string
  score: number  // 0–1
  detail: string
}

interface EpidemiologicalFingerprintProps {
  portrait?: DataPortrait | null
  dimensions?: FingerprintDimension[]
  title?: string
}

function _fromPortrait(portrait: DataPortrait): FingerprintDimension[] {
  const missPct = portrait.overall_missing_pct ?? 0
  const completeness = Math.max(0, 1 - missPct / 100)

  const nProfiles = portrait.variable_profiles.length || 1
  const outlierPct = portrait.variable_profiles
    .filter(p => p.dtype === 'numeric')
    .reduce((sum, p) => sum + (p.outlier_pct ?? 0), 0) / nProfiles
  const distQuality = Math.max(0, 1 - outlierPct / 20)

  const n = portrait.n_rows ?? 0
  const sampleAdequacy = n >= 500 ? 1 : n >= 100 ? 0.8 : n >= 30 ? 0.6 : n >= 10 ? 0.4 : 0.2

  const constantVars = portrait.variable_profiles.filter(p => p.is_constant).length
  const varDiversity = Math.max(0, 1 - constantVars / nProfiles)

  const hasDatetime = portrait.variable_profiles.some(p => p.dtype === 'datetime')
  const temporal = hasDatetime ? 0.8 : 0.5

  const binaryCount = portrait.variable_profiles.filter(p => p.role_hint === 'binary_outcome').length
  const outcomeDef = binaryCount >= 1 ? 1.0 : 0.5

  return [
    { label: 'Completeness', score: completeness, detail: `${(completeness * 100).toFixed(0)}% data present` },
    { label: 'Distribution', score: distQuality, detail: `${outlierPct.toFixed(1)}% outlier rate` },
    { label: 'Sample size', score: sampleAdequacy, detail: `n = ${n.toLocaleString()}` },
    { label: 'Var diversity', score: varDiversity, detail: `${constantVars} constant vars` },
    { label: 'Temporal', score: temporal, detail: hasDatetime ? 'Date variable present' : 'No date variable' },
    { label: 'Outcome def.', score: outcomeDef, detail: binaryCount >= 1 ? 'Binary outcome detected' : 'No clear outcome' },
  ]
}

export function EpidemiologicalFingerprint({
  portrait,
  dimensions: rawDimensions,
  title = 'Epidemiological Fingerprint',
}: EpidemiologicalFingerprintProps) {
  const dimensions = rawDimensions ?? (portrait ? _fromPortrait(portrait) : [])

  if (!dimensions.length) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        <p className="text-xs text-slate-400">No data available for fingerprint.</p>
      </div>
    )
  }

  const n = dimensions.length
  const cx = 120
  const cy = 120
  const outerR = 90
  const levels = 4

  // Compute polygon points for a given radius factor
  const pts = (scores: number[], r: number) =>
    scores.map((s, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2
      const rx = cx + r * s * Math.cos(angle)
      const ry = cy + r * s * Math.sin(angle)
      return `${rx.toFixed(2)},${ry.toFixed(2)}`
    }).join(' ')

  // Axis tip positions
  const axisTips = dimensions.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return {
      x: cx + outerR * Math.cos(angle),
      y: cy + outerR * Math.sin(angle),
      lx: cx + (outerR + 18) * Math.cos(angle),
      ly: cy + (outerR + 18) * Math.sin(angle),
    }
  })

  const overallScore = dimensions.reduce((s, d) => s + d.score, 0) / n
  const scoreColor = overallScore >= 0.8 ? '#22c55e' : overallScore >= 0.6 ? '#f59e0b' : '#ef4444'

  return (
    <div className="bg-white rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-manrope font-bold text-base text-[#191c1e]">{title}</h3>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">Score</p>
          <p className="text-xl font-mono font-bold" style={{ color: scoreColor }}>
            {(overallScore * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* SVG Radar */}
        <svg width="240" height="240" viewBox="0 0 240 240" className="shrink-0">
          {/* Grid levels */}
          {Array.from({ length: levels }).map((_, lvl) => {
            const r = outerR * ((lvl + 1) / levels)
            const levelPts = dimensions.map((_, i) => {
              const angle = (Math.PI * 2 * i) / n - Math.PI / 2
              return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`
            }).join(' ')
            return <polygon key={lvl} points={levelPts} fill="none" stroke="#f1f5f9" strokeWidth="1" />
          })}

          {/* Axis lines */}
          {axisTips.map((tip, i) => (
            <line key={i} x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke="#e2e8f0" strokeWidth="1" />
          ))}

          {/* Data polygon */}
          <polygon
            points={pts(dimensions.map(d => d.score), outerR)}
            fill="#003d9b"
            fillOpacity="0.15"
            stroke="#003d9b"
            strokeWidth="2"
          />

          {/* Data points */}
          {dimensions.map((d, i) => {
            const angle = (Math.PI * 2 * i) / n - Math.PI / 2
            const rx = cx + outerR * d.score * Math.cos(angle)
            const ry = cy + outerR * d.score * Math.sin(angle)
            return (
              <circle key={i} cx={rx} cy={ry} r="3" fill="#003d9b" />
            )
          })}

          {/* Labels */}
          {axisTips.map((tip, i) => {
            const anchor = tip.lx < cx - 5 ? 'end' : tip.lx > cx + 5 ? 'start' : 'middle'
            return (
              <text
                key={i}
                x={tip.lx}
                y={tip.ly}
                fontSize="8"
                fill="#94a3b8"
                textAnchor={anchor}
                dominantBaseline="middle"
              >
                {dimensions[i].label}
              </text>
            )
          })}
        </svg>

        {/* Dimension list */}
        <div className="flex-1 space-y-2.5 min-w-0">
          {dimensions.map(d => (
            <div key={d.label}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-semibold text-slate-600">{d.label}</span>
                <span className="text-[10px] font-mono text-slate-400">{(d.score * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${d.score * 100}%`,
                    background: d.score >= 0.8 ? '#22c55e' : d.score >= 0.6 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
              <p className="text-[9px] text-slate-400 mt-0.5">{d.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

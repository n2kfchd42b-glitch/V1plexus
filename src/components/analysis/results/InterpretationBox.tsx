"use client"

interface Props {
  plainLanguage?: string
  text: string
}

export function InterpretationBox({ plainLanguage, text }: Props) {
  const primary = plainLanguage || text
  const hasSecondary = plainLanguage && text

  if (!primary) return null

  return (
    <div
      className="rounded-2xl px-8 py-7 flex items-start gap-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #003d9b 0%, #0052cc 100%)' }}
    >
      {/* Decorative circles */}
      <div className="absolute right-[-40px] top-[-40px] w-48 h-48 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div className="absolute right-[60px] bottom-[-60px] w-40 h-40 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.04)' }} />

      {/* Lightning icon */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'rgba(255,255,255,0.12)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 relative z-10 min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] font-manrope mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
          AI Insight Engine
        </p>
        <h3 className="font-manrope font-bold text-[1.125rem] text-white mb-2">
          Key findings from your analysis
        </h3>
        <p className="text-[0.8125rem] leading-relaxed max-w-2xl" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {primary}
        </p>

        {/* Technical detail expandable */}
        {hasSecondary && (
          <details className="mt-3 group">
            <summary className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] cursor-pointer list-none transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseOver={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
              onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              Statistical details
            </summary>
            <p className="text-xs leading-relaxed mt-2.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {text}
            </p>
          </details>
        )}
      </div>
    </div>
  )
}

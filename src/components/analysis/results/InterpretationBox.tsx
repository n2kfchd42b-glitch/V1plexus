"use client"

interface Props {
  plainLanguage?: string
  text: string
}

export function InterpretationBox({ plainLanguage, text }: Props) {
  const primary = plainLanguage || text
  const secondary = plainLanguage ? text : null

  if (!primary) return null

  return (
    <div className="flex gap-3 py-4 border-b border-[var(--border-row)]">
      {/* Left accent bar */}
      <div className="w-0.5 bg-[var(--accent-primary)] rounded-full flex-shrink-0 self-stretch" />

      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium mb-1.5">
          Summary
        </p>
        <p className="text-sm text-[var(--text-primary)] leading-relaxed">
          {primary}
        </p>

        {secondary && (
          <details className="mt-2 group">
            <summary className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer list-none select-none transition-colors">
              Statistical detail ›
            </summary>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1.5 font-mono tabular-nums">
              {secondary}
            </p>
          </details>
        )}
      </div>
    </div>
  )
}

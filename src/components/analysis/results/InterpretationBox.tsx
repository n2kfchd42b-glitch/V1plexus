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
    <div className="flex gap-3 py-4 border-b border-[var(--border-row)]">
      {/* Left accent bar */}
      <div className="w-0.5 bg-[var(--accent-blue)] rounded-full flex-shrink-0 mt-0.5 self-stretch" />

      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium mb-1.5">
          Key Finding
        </p>
        <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
          {primary}
        </p>

        {hasSecondary && (
          <details className="mt-2">
            <summary className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer list-none transition-colors">
              Statistical details ›
            </summary>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1.5">
              {text}
            </p>
          </details>
        )}
      </div>
    </div>
  )
}

'use client'

interface BudgetTrackerProps {
  totalBudget: number
  currency: string
  linkedProjects: { title: string; budget_allocated: number | null }[]
}

function fmt(amount: number, currency: string): string {
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `
  if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000) return `${sym}${(amount / 1_000).toFixed(0)}K`
  return `${sym}${amount.toLocaleString()}`
}

export function BudgetTracker({ totalBudget, currency, linkedProjects }: BudgetTrackerProps) {
  const allocated = linkedProjects.reduce((s, p) => s + (p.budget_allocated ?? 0), 0)
  const remaining = totalBudget - allocated
  const allocatedPct = totalBudget > 0 ? Math.min(100, (allocated / totalBudget) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="p-3 rounded-lg bg-[var(--bg-inset)]">
          <p className="text-xs text-[var(--text-tertiary)] mb-0.5">Total Grant</p>
          <p className="font-semibold text-[var(--text-primary)]">{fmt(totalBudget, currency)}</p>
        </div>
        <div className="p-3 rounded-lg bg-[var(--bg-inset)]">
          <p className="text-xs text-[var(--text-tertiary)] mb-0.5">Allocated</p>
          <p className="font-semibold text-blue-600">{fmt(allocated, currency)}</p>
        </div>
        <div className="p-3 rounded-lg bg-[var(--bg-inset)]">
          <p className="text-xs text-[var(--text-tertiary)] mb-0.5">Remaining</p>
          <p className={`font-semibold ${remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {fmt(remaining, currency)}
          </p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1">
          <span>Budget allocation</span>
          <span>{allocatedPct.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-[var(--bg-inset)] rounded-full overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${allocatedPct > 100 ? 'bg-red-500' : 'bg-blue-500'}`}
            style={{ width: `${Math.min(100, allocatedPct)}%` }}
          />
        </div>
      </div>

      {linkedProjects.length > 0 && (
        <div className="space-y-1.5">
          {linkedProjects.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)] truncate flex-1">{p.title}</span>
              <span className="text-[var(--text-tertiary)] flex-shrink-0 ml-3">
                {p.budget_allocated ? fmt(p.budget_allocated, currency) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

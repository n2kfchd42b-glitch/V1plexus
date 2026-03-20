import { AlertCircle } from 'lucide-react'
import type { Project } from '@/types/app'
import { formatDate } from '@/lib/utils'

interface ActionItemsProps {
  projects: Project[]
}

export function ActionItems({ projects }: ActionItemsProps) {
  const overdue = projects.filter(
    (p) =>
      p.status === 'active' &&
      p.target_end_date &&
      new Date(p.target_end_date) < new Date()
  )

  if (overdue.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-amber-800">Attention needed</h3>
      </div>
      <ul className="space-y-1.5">
        {overdue.map((p) => (
          <li key={p.id} className="text-sm text-amber-700">
            <span className="font-medium">{p.title}</span> — target end date was{' '}
            {formatDate(p.target_end_date)}
          </li>
        ))}
      </ul>
    </div>
  )
}

'use client'

interface DeptRow {
  name: string
  projects: number
  publications: number
  datasets: number
  researchers: number
}

interface DepartmentComparisonProps {
  data?: DeptRow[]
}

const SAMPLE: DeptRow[] = [
  { name: 'Epidemiology',            projects: 18, publications: 12, datasets: 28, researchers: 34 },
  { name: 'Biostatistics',           projects: 15, publications:  8, datasets: 22, researchers: 28 },
  { name: 'Population & Family Hlth',projects: 12, publications:  3, datasets: 17, researchers: 25 },
]

export function DepartmentComparison({ data }: DepartmentComparisonProps) {
  const rows = data ?? SAMPLE

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            <th className="py-2 px-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Department</th>
            <th className="py-2 px-3 text-right text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Projects</th>
            <th className="py-2 px-3 text-right text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Publications</th>
            <th className="py-2 px-3 text-right text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Datasets</th>
            <th className="py-2 px-3 text-right text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Researchers</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {rows.map(row => (
            <tr key={row.name} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
              <td className="py-2.5 px-3 text-[var(--text-primary)] font-medium">{row.name}</td>
              <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">{row.projects}</td>
              <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">{row.publications}</td>
              <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">{row.datasets}</td>
              <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">{row.researchers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

'use client'

interface RegionItem {
  name: string
  count: number
}

interface GeographicReachMapProps {
  data?: RegionItem[]
}

const SAMPLE = [
  { name: 'Northern Region', count: 18 },
  { name: 'Greater Accra', count: 12 },
  { name: 'Ashanti', count: 10 },
  { name: 'Eastern Region', count: 7 },
  { name: 'Western Region', count: 6 },
  { name: 'Central Region', count: 5 },
  { name: 'Volta Region', count: 4 },
  { name: 'Brong-Ahafo', count: 3 },
]

export function GeographicReachMap({ data }: GeographicReachMapProps) {
  const items = data ?? SAMPLE
  const maxCount = Math.max(...items.map(i => i.count), 1)
  const total = items.reduce((s, i) => s + i.count, 0)

  return (
    <div className="space-y-2 p-1">
      {items.map(item => {
        const pct = Math.round((item.count / maxCount) * 100)
        const share = Math.round((item.count / total) * 100)
        return (
          <div key={item.name} className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-secondary)] w-32 truncate flex-shrink-0">{item.name}</span>
            <div className="flex-1 bg-[var(--bg-inset)] rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-[var(--text-tertiary)] w-14 text-right flex-shrink-0">
              {item.count} ({share}%)
            </span>
          </div>
        )
      })}
    </div>
  )
}

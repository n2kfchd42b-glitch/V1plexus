'use client'

import { cn } from '@/lib/utils'

interface AreaItem {
  name: string
  count: number
}

interface ResearchAreaMapProps {
  data?: AreaItem[]
}

const SAMPLE = [
  { name: 'Malaria', count: 12 },
  { name: 'Tuberculosis', count: 8 },
  { name: 'Maternal Health', count: 7 },
  { name: 'Nutrition', count: 6 },
  { name: 'HIV/AIDS', count: 5 },
  { name: 'Child Health', count: 4 },
  { name: 'Hypertension', count: 4 },
  { name: 'Diabetes', count: 3 },
  { name: 'Mental Health', count: 3 },
  { name: 'WASH', count: 2 },
]

const COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-violet-100 text-violet-800 border-violet-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-pink-100 text-pink-800 border-pink-200',
]

export function ResearchAreaMap({ data }: ResearchAreaMapProps) {
  const items = data ?? SAMPLE
  const maxCount = Math.max(...items.map(i => i.count), 1)

  return (
    <div className="flex flex-wrap gap-2 p-2">
      {items.map((item, i) => {
        const scale = 0.75 + (item.count / maxCount) * 0.5
        const colorClass = COLORS[i % COLORS.length]
        return (
          <div
            key={item.name}
            style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium cursor-default transition-transform hover:scale-105',
              colorClass
            )}
          >
            {item.name}
            <span className="opacity-70 text-[10px]">{item.count}</span>
          </div>
        )
      })}
    </div>
  )
}

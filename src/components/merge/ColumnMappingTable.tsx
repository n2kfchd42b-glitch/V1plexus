'use client'

import type { ColumnSchema } from '@/types/database'
import { ChevronDown } from 'lucide-react'

interface ColumnMappingTableProps {
  leftColumns: ColumnSchema[]
  rightColumns: ColumnSchema[]
  mapping: Record<string, string> // rightColumn -> leftColumn
  onMappingChange: (mapping: Record<string, string>) => void
}

type MatchStatus = 'match' | 'name_differs' | 'new' | 'unmapped'

function getMatchStatus(
  leftName: string | null,
  rightName: string,
  mapping: Record<string, string>
): MatchStatus {
  const mappedTo = mapping[rightName]
  if (!mappedTo) return 'new'
  if (mappedTo === rightName) return 'match'
  return 'name_differs'
}

function StatusBadge({ status }: { status: MatchStatus }) {
  switch (status) {
    case 'match':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
          <span>✓</span> Match
        </span>
      )
    case 'name_differs':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
          <span>⚠</span> Name differs
        </span>
      )
    case 'new':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
          <span>+</span> New column
        </span>
      )
    case 'unmapped':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-0.5">
          <span>−</span> Unmapped
        </span>
      )
  }
}

export function ColumnMappingTable({
  leftColumns,
  rightColumns,
  mapping,
  onMappingChange,
}: ColumnMappingTableProps) {
  const leftColNames = leftColumns.map((c) => c.name)

  // Unmapped left columns (not a target of any mapping)
  const mappedTargets = new Set(Object.values(mapping))
  const unmappedLeft = leftColumns.filter((c) => !mappedTargets.has(c.name))

  const handleMappingChange = (rightCol: string, leftCol: string) => {
    const next = { ...mapping }
    if (leftCol === '') {
      delete next[rightCol]
    } else {
      next[rightCol] = leftCol
    }
    onMappingChange(next)
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr_120px_1fr] bg-gray-50 border-b border-gray-200">
        <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Base dataset column
        </div>
        <div className="px-2 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide text-center">
          Status
        </div>
        <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Append dataset column
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Right columns with their mapping to left */}
        {rightColumns.map((rightCol) => {
          const mappedLeft = mapping[rightCol.name]
          const status = getMatchStatus(mappedLeft ?? null, rightCol.name, mapping)

          return (
            <div
              key={rightCol.name}
              className="grid grid-cols-[1fr_120px_1fr] items-center hover:bg-gray-50"
            >
              {/* Left side: select which left column to map to */}
              <div className="px-4 py-2">
                <div className="relative">
                <select
                  value={mappedLeft ?? ''}
                  onChange={(e) => handleMappingChange(rightCol.name, e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded px-2 py-1 pr-7 appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- none --</option>
                  {leftColNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Status badge */}
              <div className="px-2 py-2 flex justify-center">
                <StatusBadge status={status} />
              </div>

              {/* Right column name */}
              <div className="px-4 py-2">
                <span className="text-sm text-gray-800 font-medium">{rightCol.name}</span>
                <span className="ml-2 text-xs text-gray-400">{rightCol.type}</span>
              </div>
            </div>
          )
        })}

        {/* Unmapped left columns */}
        {unmappedLeft.map((leftCol) => (
          <div
            key={`left-${leftCol.name}`}
            className="grid grid-cols-[1fr_120px_1fr] items-center bg-gray-50/50"
          >
            <div className="px-4 py-2">
              <span className="text-sm text-gray-800 font-medium">{leftCol.name}</span>
              <span className="ml-2 text-xs text-gray-400">{leftCol.type}</span>
            </div>
            <div className="px-2 py-2 flex justify-center">
              <StatusBadge status="unmapped" />
            </div>
            <div className="px-4 py-2 text-sm text-gray-400 italic">No mapping</div>
          </div>
        ))}
      </div>

      {rightColumns.length === 0 && leftColumns.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-gray-400">No columns to display</div>
      )}
    </div>
  )
}

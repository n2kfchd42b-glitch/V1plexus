'use client'

import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'
import type { ColumnSchema } from '@/types/database'

interface ColumnStatsPopoverProps {
  schema: ColumnSchema
}

export function ColumnStatsPopover({ schema }: ColumnStatsPopoverProps) {
  const isNumeric = ['integer', 'decimal', 'number'].includes(schema.type)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        className="p-0.5 rounded hover:bg-gray-200 transition-colors"
        onClick={() => setOpen(v => !v)}
        aria-label="Column statistics"
      >
        <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
      </button>

      {open && (
        <div className="absolute z-50 left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <div className="space-y-2">
            <div className="font-medium text-sm text-gray-900 truncate">{schema.name}</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 rounded p-2">
                <div className="text-gray-500">Nulls</div>
                <div className="font-medium text-gray-900">{schema.null_count}</div>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <div className="text-gray-500">Unique</div>
                <div className="font-medium text-gray-900">{schema.unique_count}</div>
              </div>
              {isNumeric && schema.min !== undefined && (
                <>
                  <div className="bg-blue-50 rounded p-2">
                    <div className="text-blue-600">Min</div>
                    <div className="font-medium text-gray-900">{typeof schema.min === 'number' ? schema.min.toFixed(2) : schema.min}</div>
                  </div>
                  <div className="bg-blue-50 rounded p-2">
                    <div className="text-blue-600">Max</div>
                    <div className="font-medium text-gray-900">{typeof schema.max === 'number' ? schema.max?.toFixed(2) : schema.max}</div>
                  </div>
                  {schema.mean !== undefined && schema.mean !== null && (
                    <div className="bg-blue-50 rounded p-2">
                      <div className="text-blue-600">Mean</div>
                      <div className="font-medium text-gray-900">{schema.mean.toFixed(2)}</div>
                    </div>
                  )}
                  {schema.median !== undefined && schema.median !== null && (
                    <div className="bg-blue-50 rounded p-2">
                      <div className="text-blue-600">Median</div>
                      <div className="font-medium text-gray-900">{schema.median.toFixed(2)}</div>
                    </div>
                  )}
                </>
              )}
            </div>
            {schema.value_counts && Object.keys(schema.value_counts).length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Top Values</div>
                <div className="space-y-1">
                  {Object.entries(schema.value_counts)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([val, count]) => (
                      <div key={val} className="flex items-center gap-2">
                        <span className="text-xs text-gray-700 flex-1 truncate">{val}</span>
                        <span className="text-xs text-gray-500">{count}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-gray-500 mb-1">Sample Values</div>
              <div className="flex flex-wrap gap-1">
                {schema.sample_values.slice(0, 5).map((v, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded truncate max-w-20">
                    {v === null ? 'null' : String(v)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

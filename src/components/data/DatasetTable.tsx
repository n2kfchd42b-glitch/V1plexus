'use client'

import { useState, useRef, useMemo, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Columns, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ColumnStatsPopover } from './ColumnStatsPopover'
import type { DataRow, ColumnSchema } from '@/types/database'

const TYPE_COLORS: Record<string, string> = {
  integer: 'bg-blue-100 text-blue-700',
  decimal: 'bg-blue-100 text-blue-700',
  number: 'bg-blue-100 text-blue-700',
  text: 'bg-gray-100 text-gray-600',
  categorical: 'bg-purple-100 text-purple-700',
  date: 'bg-green-100 text-green-700',
  boolean: 'bg-orange-100 text-orange-700',
}

interface DatasetTableProps {
  rows: DataRow[]
  columns: ColumnSchema[]
  className?: string
}

export function DatasetTable({ rows, columns, className = '' }: DatasetTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [columnSearch, setColumnSearch] = useState('')
  const parentRef = useRef<HTMLDivElement>(null)

  // Build tanstack column defs from schema
  const columnDefs = useMemo(() => columns.map(col => ({
    id: col.name,
    accessorKey: col.name,
    header: () => (
      <div className="flex items-center gap-1 min-w-0">
        <span className="truncate font-medium text-xs text-gray-900">{col.name}</span>
        <span className={`shrink-0 text-[10px] font-medium px-1 py-0.5 rounded ${TYPE_COLORS[col.type] ?? 'bg-gray-100 text-gray-600'}`}>
          {col.type}
        </span>
        <ColumnStatsPopover schema={col} />
      </div>
    ),
    cell: ({ getValue }: { getValue: () => unknown }) => {
      const val = getValue()
      if (val === null || val === undefined) {
        return <span className="text-gray-300 italic text-xs">null</span>
      }
      if (typeof val === 'boolean') {
        return <span className={`text-xs font-medium ${val ? 'text-green-600' : 'text-red-500'}`}>{val ? 'true' : 'false'}</span>
      }
      return <span className="text-xs text-gray-800">{String(val)}</span>
    },
    size: 150,
    minSize: 80,
    maxSize: 400,
  })), [columns])

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const { rows: tableRows } = table.getRowModel()

  // Virtualization
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom = virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0

  const visibleCols = table.getVisibleLeafColumns()

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b bg-white shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search all columns..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowColumnMenu(v => !v); setColumnSearch('') }}
            className="gap-1"
          >
            <Columns className="h-3.5 w-3.5" />
            Columns
            <ChevronDown className="h-3 w-3" />
          </Button>
          {showColumnMenu && (
            <div className="absolute right-0 top-9 z-50 bg-white border rounded-lg shadow-lg w-56" style={{ maxHeight: '320px', display: 'flex', flexDirection: 'column' }}>
              {/* Search */}
              <div className="p-2 border-b shrink-0">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    value={columnSearch}
                    onChange={e => setColumnSearch(e.target.value)}
                    placeholder="Search columns..."
                    className="pl-7 h-7 text-xs"
                    autoFocus
                  />
                </div>
              </div>
              {/* Select all / Deselect all */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b shrink-0">
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => table.toggleAllColumnsVisible(true)}
                >
                  Select all
                </button>
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => table.toggleAllColumnsVisible(false)}
                >
                  Deselect all
                </button>
              </div>
              {/* Column list */}
              <div className="overflow-y-auto flex-1 p-1">
                {table.getAllLeafColumns()
                  .filter(col => col.id.toLowerCase().includes(columnSearch.toLowerCase()))
                  .map(col => (
                    <label key={col.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={col.getIsVisible()}
                        onChange={col.getToggleVisibilityHandler()}
                        className="rounded"
                      />
                      <span className="truncate">{col.id}</span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>
        <span className="text-xs text-gray-500 ml-auto shrink-0">
          {tableRows.length.toLocaleString()} of {rows.length.toLocaleString()} rows
        </span>
      </div>

      {/* Table with virtualized scrolling */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <table className="w-full border-collapse" style={{ minWidth: `${visibleCols.length * 150}px` }}>
          <thead className="sticky top-0 z-10 bg-gray-50">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="border-b border-r last:border-r-0 px-3 py-2 text-left select-none"
                    style={{ width: header.getSize() }}
                  >
                    <div
                      className={`flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer hover:text-gray-700' : ''}`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="ml-auto shrink-0">
                          {header.column.getIsSorted() === 'asc' ? (
                            <ArrowUp className="h-3 w-3 text-blue-600" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ArrowDown className="h-3 w-3 text-blue-600" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-gray-300" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && <tr><td style={{ height: paddingTop }} /></tr>}
            {virtualRows.map(virtualRow => {
              const row = tableRows[virtualRow.index]
              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  className="hover:bg-blue-50/50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-3 py-2 border-r last:border-r-0 max-w-xs">
                      <div className="truncate">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    </td>
                  ))}
                </tr>
              )
            })}
            {paddingBottom > 0 && <tr><td style={{ height: paddingBottom }} /></tr>}
          </tbody>
        </table>
        {tableRows.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">No rows match your search</p>
          </div>
        )}
      </div>
    </div>
  )
}

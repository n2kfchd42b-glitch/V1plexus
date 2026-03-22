'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { useState, useEffect, useMemo } from 'react'
import { Table2, ExternalLink, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { loadVersionData } from '@/lib/data/storage'
import type { ColumnSchema, DataRow } from '@/types/database'

// ─── React component rendered inside the editor ─────────────────────────────

function DatasetTableView({ node }: { node: { attrs: Record<string, string | number> } }) {
  const { datasetId, versionId, datasetName, maxRows } = node.attrs as {
    datasetId: string
    versionId: string
    datasetName: string
    maxRows: number
  }

  const [rows, setRows] = useState<DataRow[]>([])
  const [columns, setColumns] = useState<ColumnSchema[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!versionId) return
    const supabase = createClient()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: version } = await supabase
          .from('dataset_versions')
          .select('file_path, schema_info, row_count')
          .eq('id', versionId)
          .single()

        if (!version) throw new Error('Version not found')

        const parsed = await loadVersionData(version.file_path)
        setRows(parsed.rows.slice(0, maxRows || 20))
        setColumns(parsed.columns)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [versionId, maxRows])

  const displayCols = useMemo(() => columns.slice(0, 10), [columns])

  return (
    <NodeViewWrapper className="my-4">
      <div className="border rounded-lg overflow-hidden bg-white shadow-sm" contentEditable={false}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
          <Table2 className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-sm font-medium text-blue-900 truncate flex-1">
            {datasetName || 'Dataset Table'}
          </span>
          {datasetId && (
            <a
              href={`/projects/data/${datasetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* Table body */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading table data...
          </div>
        ) : error ? (
          <div className="px-4 py-6 text-center text-sm text-red-600">{error}</div>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {displayCols.map(col => (
                    <th key={col.name} className="px-2 py-1.5 text-left font-medium text-gray-600 border-b whitespace-nowrap">
                      {col.name}
                      <span className="ml-1 text-[10px] text-gray-400">{col.type}</span>
                    </th>
                  ))}
                  {columns.length > 10 && (
                    <th className="px-2 py-1.5 text-left font-medium text-gray-400 border-b text-[10px] italic">
                      +{columns.length - 10} more
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    {displayCols.map(col => (
                      <td key={col.name} className="px-2 py-1 text-gray-700 whitespace-nowrap max-w-[150px] truncate">
                        {row[col.name] === null ? (
                          <span className="text-gray-300 italic">null</span>
                        ) : (
                          String(row[col.name])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && !error && rows.length > 0 && (
          <div className="px-3 py-1.5 bg-gray-50 border-t text-[11px] text-gray-500">
            Showing {rows.length} of {maxRows || 20}+ rows · {columns.length} columns
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// ─── TipTap Node Extension ──────────────────────────────────────────────────

export const DatasetTableExtension = Node.create({
  name: 'datasetTable',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      datasetId: { default: '' },
      versionId: { default: '' },
      datasetName: { default: '' },
      maxRows: { default: 20 },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="dataset-table"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'dataset-table' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(DatasetTableView)
  },
})

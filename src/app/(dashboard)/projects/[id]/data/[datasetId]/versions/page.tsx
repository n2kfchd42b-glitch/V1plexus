'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, GitCommit, Plus, Minus, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VersionTimeline } from '@/components/data/VersionTimeline'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { format } from 'date-fns'
import type { Dataset, DatasetVersion, DatasetBranch, ColumnSchema, CleaningOperation } from '@/types/database'

// ─── Schema diff helpers ─────────────────────────────────────────────────────

interface SchemaDiff {
  added: ColumnSchema[]
  removed: ColumnSchema[]
  renamed: { from: string; to: string; type: string }[]
  unchanged: ColumnSchema[]
}

function computeSchemaDiff(parentSchema: ColumnSchema[], childSchema: ColumnSchema[]): SchemaDiff {
  const parentByName = new Map(parentSchema.map(c => [c.name, c]))
  const childByName = new Map(childSchema.map(c => [c.name, c]))

  const added = childSchema.filter(c => !parentByName.has(c.name))
  const removed = parentSchema.filter(c => !childByName.has(c.name))
  const unchanged = childSchema.filter(c => parentByName.has(c.name))

  // Simple heuristic for renames: pair added+removed of same type if counts match
  const renamed: { from: string; to: string; type: string }[] = []
  if (added.length === removed.length && added.length > 0) {
    for (let i = 0; i < added.length; i++) {
      if (removed[i] && added[i].type === removed[i].type) {
        renamed.push({ from: removed[i].name, to: added[i].name, type: added[i].type })
      }
    }
  }

  return { added, removed, renamed, unchanged }
}

// ─── Operation label helper ───────────────────────────────────────────────────

function operationLabel(op: CleaningOperation): string {
  switch (op.type) {
    case 'rename_column': return `Renamed "${op.column}" → "${op.new_name}"`
    case 'retype_column': return `Changed type of "${op.column}" to ${op.new_type}`
    case 'delete_column': return `Deleted column "${op.column}"`
    case 'reorder_columns': return `Reordered ${op.order.length} columns`
    case 'drop_missing': return `Dropped rows with missing values in [${op.columns.join(', ')}]`
    case 'fill_missing': return `Filled missing values in "${op.column}" (${op.strategy})`
    case 'filter_rows': return `Filtered rows: "${op.column}" ${op.operator} ${op.value} (${op.keep ? 'keep' : 'remove'})`
    case 'remove_duplicates': return `Removed duplicates on [${op.columns.join(', ')}]`
    case 'sort_rows': return `Sorted by "${op.column}" (${op.direction})`
    case 'computed_column': return `Added computed column "${op.name}"`
    case 'recode_values': return `Recoded values in "${op.column}"`
    case 'bin_numeric': return `Binned "${op.column}" → "${op.new_column}"`
    case 'standardize_text': return `Standardized text in "${op.column}"`
    default: return 'Unknown operation'
  }
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function VersionsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const datasetId = params.datasetId as string
  const { user, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [versions, setVersions] = useState<DatasetVersion[]>([])
  const [branches, setBranches] = useState<DatasetBranch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVersionId, setSelectedVersionId] = useState<string>('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [dsRes, vRes, bRes] = await Promise.all([
          supabase.from('datasets').select('*').eq('id', datasetId).single(),
          supabase
            .from('dataset_versions')
            .select('*')
            .eq('dataset_id', datasetId)
            .order('version_number', { ascending: false }),
          supabase
            .from('dataset_branches')
            .select('*')
            .eq('dataset_id', datasetId)
            .order('is_default', { ascending: false }),
        ])
        if (dsRes.error) throw dsRes.error
        setDataset(dsRes.data)

        const vList: DatasetVersion[] = vRes.data ?? []
        const bList: DatasetBranch[] = bRes.data ?? []
        setVersions(vList)
        setBranches(bList)

        // Select head of default branch
        const defaultBranch = bList.find(b => b.is_default) ?? bList[0]
        if (defaultBranch) {
          setSelectedVersionId(defaultBranch.head_version)
        } else if (vList.length > 0) {
          setSelectedVersionId(vList[0].id)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load versions')
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, user])

  const selectedVersion = versions.find(v => v.id === selectedVersionId) ?? null
  const parentVersion = selectedVersion?.parent_version
    ? versions.find(v => v.id === selectedVersion.parent_version) ?? null
    : null

  const schemaDiff = selectedVersion && parentVersion
    ? computeSchemaDiff(parentVersion.schema_info, selectedVersion.schema_info)
    : null

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user || !dataset) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <p className="text-sm text-muted-foreground">Dataset not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b bg-white">
        <Link href={`/projects/${projectId}/data/${datasetId}`}>
          <Button variant="ghost" size="sm" className="mb-3 h-7 text-xs -ml-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to dataset
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{dataset.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Version history &middot; {versions.length} version{versions.length !== 1 ? 's' : ''} &middot; {branches.length} branch{branches.length !== 1 ? 'es' : ''}
          </p>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Timeline sidebar */}
        <div className="w-80 shrink-0 border-r border-gray-200 overflow-y-auto p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 px-1">
            Timeline
          </h2>
          <VersionTimeline
            versions={versions}
            branches={branches}
            currentVersionId={selectedVersionId}
            onVersionSelect={setSelectedVersionId}
          />
        </div>

        {/* Details panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedVersion ? (
            <div className="p-6 space-y-6 max-w-3xl">
              {/* Version header */}
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
                    <GitCommit className="h-4 w-4 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    v{selectedVersion.version_number}: {selectedVersion.commit_message}
                  </h2>
                </div>
                <div className="ml-11 flex items-center gap-4 text-sm text-gray-500">
                  <span>{format(new Date(selectedVersion.created_at), 'PPpp')}</span>
                  <span>{selectedVersion.row_count.toLocaleString()} rows</span>
                  <span>{selectedVersion.column_count} columns</span>
                </div>
                {parentVersion && (
                  <div className="ml-11 mt-2 text-xs text-gray-400">
                    Parent: v{parentVersion.version_number} — {parentVersion.commit_message}
                  </div>
                )}
              </div>

              {/* Schema diff */}
              {schemaDiff && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Schema changes from v{parentVersion!.version_number}</h3>
                  {schemaDiff.added.length === 0 && schemaDiff.removed.length === 0 && schemaDiff.renamed.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No schema changes in this version.</p>
                  ) : (
                    <div className="space-y-2">
                      {schemaDiff.added.map(col => (
                        <div key={col.name} className="flex items-center gap-2 text-sm p-2 bg-green-50 border border-green-200 rounded-lg">
                          <Plus className="h-3.5 w-3.5 text-green-600 shrink-0" />
                          <span className="font-medium text-green-800">{col.name}</span>
                          <span className="text-green-600 text-xs">{col.type}</span>
                          <span className="ml-auto text-xs text-green-500">added</span>
                        </div>
                      ))}
                      {schemaDiff.removed.map(col => (
                        <div key={col.name} className="flex items-center gap-2 text-sm p-2 bg-red-50 border border-red-200 rounded-lg">
                          <Minus className="h-3.5 w-3.5 text-red-600 shrink-0" />
                          <span className="font-medium text-red-800">{col.name}</span>
                          <span className="text-red-600 text-xs">{col.type}</span>
                          <span className="ml-auto text-xs text-red-500">removed</span>
                        </div>
                      ))}
                      {schemaDiff.renamed.map(r => (
                        <div key={r.from} className="flex items-center gap-2 text-sm p-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <ArrowRight className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          <span className="font-medium text-amber-800">{r.from}</span>
                          <ArrowRight className="h-3 w-3 text-amber-400" />
                          <span className="font-medium text-amber-800">{r.to}</span>
                          <span className="text-amber-600 text-xs">{r.type}</span>
                          <span className="ml-auto text-xs text-amber-500">renamed</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* No parent = first version */}
              {!parentVersion && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Schema ({selectedVersion.schema_info.length} columns)</h3>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
                    {selectedVersion.schema_info.map(col => (
                      <div key={col.name} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <span className="font-medium text-gray-800 flex-1">{col.name}</span>
                        <span className="text-xs text-gray-400">{col.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Operations */}
              {selectedVersion.operations && selectedVersion.operations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Operations ({selectedVersion.operations.length})
                  </h3>
                  <div className="space-y-1.5">
                    {selectedVersion.operations.map((op, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-sm p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                        <span className="text-xs text-gray-400 font-mono mt-0.5 shrink-0 w-5 text-right">{i + 1}.</span>
                        <div>
                          <span className="inline-block text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 mr-2 mb-0.5">
                            {op.type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-gray-600">{operationLabel(op)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty operations */}
              {(!selectedVersion.operations || selectedVersion.operations.length === 0) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Operations</h3>
                  <p className="text-sm text-gray-400 italic">No operations recorded for this version.</p>
                </div>
              )}

              {/* Navigate to this version */}
              <div className="pt-2 border-t border-gray-100">
                <Link href={`/projects/${projectId}/data/${datasetId}?version=${selectedVersion.id}`}>
                  <Button variant="outline" size="sm">
                    View data at this version
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[300px] text-sm text-gray-400">
              Select a version from the timeline to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

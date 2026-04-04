'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DataQualityScorecard } from '@/components/dataset-hub/DataQualityScorecard'
import { EnumeratorQualityPanel } from '@/components/dataset-hub/EnumeratorQualityPanel'
import type { QualityReport } from '@/types/qualityIntelligence'

type Tab = 'overview' | 'enumerators'

export default function DatasetQualityPage() {
  const params = useParams()
  const projectId = params.id as string
  const datasetId = params.datasetId as string

  const [datasetName, setDatasetName] = useState<string>('')
  const [versionId, setVersionId] = useState<string | null>(null)
  const [versionNumber, setVersionNumber] = useState<number | null>(null)
  const [report, setReport] = useState<QualityReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const supabase = createClient()

  // Load dataset name + latest version
  useEffect(() => {
    const init = async () => {
      const { data: dataset } = await supabase
        .from('datasets')
        .select('name')
        .eq('id', datasetId)
        .single()
      if (dataset) setDatasetName(dataset.name)

      const { data: version } = await supabase
        .from('dataset_versions')
        .select('id, version_number')
        .eq('dataset_id', datasetId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single()
      if (version) {
        setVersionId(version.id)
        setVersionNumber(version.version_number)
      }
    }
    init()
  }, [datasetId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch quality report once we have the version
  useEffect(() => {
    if (!versionId) return
    fetchReport(versionId)
  }, [versionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchReport = async (vid: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/datasets/${datasetId}/quality?version_id=${vid}`)
      if (res.ok) {
        const data: QualityReport = await res.json()
        setReport(data)
      } else {
        setReport(null)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRecompute = async () => {
    if (!versionId) return
    setRecomputing(true)
    try {
      const res = await fetch(`/api/datasets/${datasetId}/quality`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: versionId }),
      })
      if (res.ok) {
        const data: QualityReport = await res.json()
        setReport(data)
      } else {
        // Fall back to GET in case POST returned an error
        await fetchReport(versionId)
      }
    } finally {
      setRecomputing(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg-base)]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-4">
        <div className="flex items-center gap-3 mb-1">
          <Link
            href={`/projects/${projectId}/data/${datasetId}`}
            className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to {datasetName || 'Dataset'}
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-[var(--accent-blue)]" />
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                Data Quality Intelligence
              </h1>
              {versionNumber !== null && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  {datasetName} · v{versionNumber}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleRecompute}
            disabled={recomputing || !versionId}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${recomputing ? 'animate-spin' : ''}`} />
            {recomputing ? 'Recomputing…' : 'Recompute'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {(['overview', 'enumerators'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-[var(--bg-surface-hover)] text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {tab === 'overview' ? 'Quality Overview' : 'Enumerator Metrics'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] h-32 animate-pulse" />
            ))}
          </div>
        ) : report === null ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <ShieldCheck className="h-10 w-10 text-[var(--text-tertiary)]" />
            <p className="text-[var(--text-secondary)] text-sm font-medium">No quality report computed yet</p>
            <p className="text-xs text-[var(--text-tertiary)] max-w-xs">
              Run the quality engine to get a DQI score, dimension breakdown, and enumerator analysis.
            </p>
            <button
              onClick={handleRecompute}
              disabled={recomputing || !versionId}
              className="mt-2 flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${recomputing ? 'animate-spin' : ''}`} />
              {recomputing ? 'Computing…' : 'Compute Quality Report'}
            </button>
          </div>
        ) : activeTab === 'overview' ? (
          <DataQualityScorecard
            report={report}
            isLoading={recomputing}
            onRecompute={handleRecompute}
          />
        ) : (
          <EnumeratorQualityPanel
            metrics={report.enumerator_metrics ?? null}
            isLoading={recomputing}
          />
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import type { SupervisorQueueItem, ApprovalRequestStatus } from '@/types/approvals'
import { useLocale } from '@/i18n/LocaleProvider'

type FilterTab = 'active' | 'pending' | 'in_review' | 'revision_requested' | 'approved' | 'rejected'

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function AgeColor({ hours }: { hours: number }) {
  const cls = hours > 168 ? 'text-red-500' : hours > 48 ? 'text-amber-500' : 'text-[var(--text-tertiary)]'
  return <span className={`text-[10px] ${cls}`}>{hours > 168 ? '⚠ ' : ''}{Math.round(hours)}h ago</span>
}

export default function ApprovalsPage() {
  const router = useRouter()
  const { t } = useLocale()
  const [items, setItems] = useState<SupervisorQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('active')
  const [pending, setPending] = useState(0)
  const [inReview, setInReview] = useState(0)

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/approvals/queue')
      if (!res.ok) return
      const data = await res.json()
      setItems(data.queue ?? [])
      setPending(data.pending ?? 0)
      setInReview(data.in_review ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  const STATUS_CHIP: Record<ApprovalRequestStatus, { label: string; className: string }> = {
    pending:             { label: t('approvals.status.pending'),         className: 'bg-amber-100 text-amber-700' },
    in_review:           { label: t('approvals.status.inReview'),        className: 'bg-blue-100 text-blue-700' },
    approved:            { label: t('approvals.status.approved'),        className: 'bg-green-100 text-green-700' },
    rejected:            { label: t('approvals.status.rejected'),        className: 'bg-red-100 text-red-700' },
    revision_requested:  { label: t('approvals.status.revisionsNeeded'), className: 'bg-amber-100 text-amber-700' },
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'active',             label: t('approvals.tab.active') },
    { key: 'pending',            label: t('approvals.tab.pending') },
    { key: 'in_review',          label: t('approvals.tab.inReview') },
    { key: 'revision_requested', label: t('approvals.tab.revisions') },
  ]

  const filtered = items.filter((item) => {
    if (filter === 'active') return ['pending', 'in_review', 'revision_requested'].includes(item.status)
    return item.status === filter
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 overflow-x-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-[var(--text-primary)]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {t('approvals.title')}
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            {t('approvals.subtitle')}
          </p>
        </div>
        <div className="flex gap-2 mt-1">
          {pending === 0 && inReview === 0 ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-[11px] font-bold">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t('approvals.allReviewed')}
            </span>
          ) : (
            <>
              {pending > 0 && (
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
                  {pending} {t('approvals.status.pending')}
                </span>
              )}
              {inReview > 0 && (
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
                  {inReview} {t('approvals.status.inReview')}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === tab.key
                ? 'bg-[var(--accent-primary)] text-white'
                : 'bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
          <p className="text-lg font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {t('approvals.emptyTitle')}
          </p>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">{t('approvals.emptySubtitle')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const chip = STATUS_CHIP[item.status]
            return (
              <div
                key={item.request_id}
                className="rounded-2xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] shadow-sm p-5 hover:-translate-y-px transition-transform cursor-pointer"
                onClick={() => router.push(`/approvals/${item.request_id}`)}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {item.dataset_name}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-inset)] text-[var(--text-tertiary)]">
                        v{item.version_number}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">{item.project_name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${chip.className}`}>
                      {chip.label}
                    </span>
                    <AgeColor hours={item.hours_since_submission} />
                  </div>
                </div>

                {/* Middle row */}
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                      {item.researcher_initials}
                    </div>
                    <span className="text-[12px] text-[var(--text-secondary)]">{item.researcher_name}</span>
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    {item.operations_count > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        {item.operations_count} {t('approvals.operations')}
                      </span>
                    )}
                    {item.has_imputation && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{t('approvals.mice')}</span>
                    )}
                    {item.has_duplicate_resolution && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{t('approvals.deduped')}</span>
                    )}
                  </div>

                  <span className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1 ml-auto">
                    <Shield className="h-3 w-3" /> {item.audit_entry_count} {t('approvals.auditEntries')}
                  </span>
                </div>

                {/* Bottom row */}
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  {item.request_message ? (
                    <p className="text-[11px] text-[var(--text-tertiary)] italic line-clamp-1 flex-1">
                      &ldquo;{item.request_message}&rdquo;
                    </p>
                  ) : <span />}
                  <span className="text-[12px] font-semibold text-[var(--accent-blue)] shrink-0">
                    {t('approvals.reviewLink')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AuditLog } from '@/types/database'
import { TimelineEntryPanel } from './TimelineEntryPanel'
import {
  isVisible, describeEntry, typeBadgeClass, groupByDay, fmtTime,
  type DayGroup,
} from './timelineUtils'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 60

const groupVariants: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.04 } },
}
const entryVariants: Variants = {
  hidden:  { opacity: 0, y: 5 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.15, ease: 'easeOut' } },
}

interface Props {
  projectId: string
}

// ── Single entry row ────────────────────────────────────────────────────────

function EntryRow({
  entry,
  selected,
  onClick,
}: {
  entry: AuditLog
  selected: boolean
  onClick: () => void
}) {
  const { typeLabel, title, subtitle } = describeEntry(entry)

  return (
    <motion.button
      variants={entryVariants}
      onClick={onClick}
      className={cn(
        'row-item w-full text-left',
        selected && 'bg-[var(--bg-row-active)]'
      )}
    >
      {/* Time */}
      <span className="data-mono-xs text-[var(--text-tertiary)] w-16 flex-shrink-0 text-right pr-3">
        {fmtTime(entry.timestamp)}
      </span>

      {/* Type badge */}
      <span className={cn(
        'text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0',
        typeBadgeClass(typeLabel)
      )}>
        {typeLabel}
      </span>

      {/* Title + subtitle */}
      <div className="flex-1 min-w-0 px-3">
        <p className="text-sm text-[var(--text-primary)] truncate leading-snug">{title}</p>
        {subtitle && (
          <p className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Verification dot */}
      <span className="status-dot status-dot--verified flex-shrink-0" />
    </motion.button>
  )
}

// ── Loading skeleton row ────────────────────────────────────────────────────

function SkeletonEntryRow() {
  return (
    <div className="row-item pointer-events-none">
      <div className="skeleton h-3 w-12 rounded flex-shrink-0" />
      <div className="skeleton h-4 w-14 rounded flex-shrink-0 mx-3" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="skeleton h-3.5 w-48 rounded" />
        <div className="skeleton h-3 w-28 rounded" />
      </div>
      <div className="skeleton h-1.5 w-1.5 rounded-full flex-shrink-0" />
    </div>
  )
}

// ── Main feed ───────────────────────────────────────────────────────────────

export function TimelineFeed({ projectId }: Props) {
  const [entries,  setEntries]  = useState<AuditLog[]>([])
  const [groups,   setGroups]   = useState<DayGroup[]>([])
  const [loading,  setLoading]  = useState(true)
  const [hasMore,  setHasMore]  = useState(false)
  const [offset,   setOffset]   = useState(0)
  const [selected, setSelected] = useState<AuditLog | null>(null)

  const supabase = createClient()

  const fetchEntries = useCallback(async (reset = false) => {
    setLoading(true)
    const currentOffset = reset ? 0 : offset

    const { data } = await supabase
      .from('audit_logs')
      .select('*, actor:profiles(id, full_name, email, avatar_url)')
      .eq('project_id', projectId)
      .order('timestamp', { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1)

    const rows = (data ?? []) as AuditLog[]
    const visible = rows.filter(e => isVisible(e.action))

    const next = reset ? visible : [...entries, ...visible]
    setEntries(next)
    setGroups(groupByDay(next))
    setOffset(currentOffset + rows.length)
    setHasMore(rows.length === PAGE_SIZE)
    setLoading(false)
  }, [projectId, offset]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchEntries(true) }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (entry: AuditLog) => {
    setSelected(prev => prev?.id === entry.id ? null : entry)
  }

  // Empty state
  if (!loading && entries.length === 0) {
    return (
      <div className="flex-1 flex">
        <div className="flex-1 flex items-center justify-center">
          <div className="empty-state">
            <Clock className="empty-state-icon h-8 w-8" />
            <p className="empty-state-title">Your timeline is empty</p>
            <p className="empty-state-description">
              Upload a dataset or run an analysis — every action will appear here automatically.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">

        {/* Loading skeletons */}
        {loading && (
          <div className="border-t border-[var(--border-row)]">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonEntryRow key={i} />)}
          </div>
        )}

        {/* Day groups */}
        {!loading && groups.map(group => (
          <motion.div
            key={group.isoDate}
            initial="hidden"
            animate="visible"
            variants={groupVariants}
          >
            <p className="section-label">{group.label}</p>
            {group.entries.map(entry => (
              <EntryRow
                key={entry.id}
                entry={entry}
                selected={selected?.id === entry.id}
                onClick={() => handleSelect(entry)}
              />
            ))}
          </motion.div>
        ))}

        {/* Load more */}
        {!loading && hasMore && (
          <div className="px-6 py-4">
            <button
              onClick={() => fetchEntries(false)}
              className="text-xs text-[var(--accent-blue)] hover:underline"
            >
              Load more
            </button>
          </div>
        )}
      </div>

      {/* Right context panel */}
      <AnimatePresence>
        {selected && (
          <TimelineEntryPanel
            key={selected.id}
            entry={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

    </div>
  )
}

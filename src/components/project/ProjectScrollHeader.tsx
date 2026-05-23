'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { InteractivePhaseBar } from './InteractivePhaseBar'
import type { GanttPhase } from './ProjectGantt'

// Global Header height (h-16). Tab bar sticks immediately below it.
const HEADER_HEIGHT = 64

interface BadgeStyle { bg: string; text: string; border: string; label: string }

interface ProjectScrollHeaderProps {
  projectId: string
  userId: string
  title: string
  badge: BadgeStyle
  phases: GanttPhase[]
  datasetCount: number
  runCount: number
  isThesis?: boolean
}

export function ProjectScrollHeader({
  projectId,
  userId,
  title,
  badge,
  phases,
  datasetCount,
  runCount,
  isThesis = false,
}: ProjectScrollHeaderProps) {
  const pathname = usePathname()

  const overviewHref   = `/projects/${projectId}/overview`
  const isOverview     = pathname === overviewHref || pathname === `/projects/${projectId}`
  const isDocEditor    = pathname.startsWith(`/projects/${projectId}/documents/`)
  const isOutsideWorkflow = !isOverview
    && !pathname.startsWith(`/projects/${projectId}/data`)
    && !pathname.startsWith(`/projects/${projectId}/analysis`)
    && !pathname.startsWith(`/projects/${projectId}/documents`)
    && !pathname.startsWith(`/projects/${projectId}/chapters`)
    && !pathname.startsWith(`/projects/${projectId}/setup`)
  const collapsed      = !isOverview

  if (isDocEditor || isOutsideWorkflow) return null

  const tabs = [
    { slug: 'overview',  label: 'Overview',  count: null as number | null },
    ...(isThesis ? [
      { slug: 'chapters', label: 'Chapters', count: null as number | null },
    ] : []),
    { slug: 'data',      label: 'Data',       count: datasetCount          },
    { slug: 'analysis',  label: 'Analysis',   count: runCount > 0 ? runCount : null },
    { slug: 'documents', label: 'Writing',    count: null                  },
    ...(isThesis ? [
      { slug: 'setup', label: 'Setup', count: null as number | null },
    ] : []),
  ]

  return (
    <>
      {/* ── Hero strip ── collapses when not on overview ────────────────────── */}
      <div
        className="flex-shrink-0 overflow-hidden"
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-default)',
          borderBottomColor: collapsed ? 'transparent' : 'var(--border-default)',
          maxHeight: collapsed ? 0 : '120px',
          paddingTop: collapsed ? 0 : '0.75rem',
          paddingBottom: collapsed ? 0 : '0.75rem',
          paddingLeft: '1.5rem',
          paddingRight: '1.5rem',
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
          transition:
            'max-height 200ms ease, padding-top 200ms ease, padding-bottom 200ms ease, opacity 150ms ease, border-bottom-color 150ms ease',
        }}
      >
        <div className="flex items-baseline gap-2.5 flex-wrap mb-2">
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(16px, 4vw, 22px)',
              fontStyle: 'italic',
              fontWeight: 400,
              color: 'var(--text-primary)',
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
          <span
            className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium flex-shrink-0"
            style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}
          >
            {badge.label}
          </span>
        </div>

        <InteractivePhaseBar
          projectId={projectId}
          userId={userId}
          initialPhases={phases}
          height={6}
          className="w-full sm:max-w-xl"
        />
      </div>

      {/* ── Tab bar ── always sticky below global header ─────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center overflow-x-auto"
        style={{
          position: 'sticky',
          top: HEADER_HEIGHT,
          zIndex: 20,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-default)',
          boxShadow: collapsed ? 'var(--shadow-sm)' : 'none',
          transition: 'box-shadow 200ms ease',
        }}
      >
        {/* Project name pill — visible only in work sections when hero is gone */}
        <div
          className="flex items-center gap-1.5 flex-shrink-0"
          style={{
            overflow: 'hidden',
            maxWidth: collapsed ? '220px' : '0px',
            opacity: collapsed ? 1 : 0,
            paddingLeft: collapsed ? '1rem' : 0,
            paddingRight: collapsed ? '0.75rem' : 0,
            borderRight: '1px solid var(--border-default)',
            borderRightColor: collapsed ? 'var(--border-default)' : 'transparent',
            transition:
              'max-width 200ms ease, opacity 150ms ease, padding-left 200ms ease, padding-right 200ms ease, border-right-color 150ms ease',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '13px',
              fontStyle: 'italic',
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </span>
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0"
            style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}
          >
            {badge.label}
          </span>
        </div>

        {/* Section tabs */}
        <div className="flex px-3 sm:px-4">
          {tabs.map(tab => {
            const href   = `/projects/${projectId}/${tab.slug}`
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link key={tab.slug} href={href}>
                <div
                  className={cn(
                    'flex items-center gap-1.5 h-10 px-3 border-b-2 -mb-px cursor-pointer whitespace-nowrap transition-colors duration-150',
                    'text-[13px] font-medium',
                    active
                      ? 'text-[var(--text-primary)] border-[var(--accent-blue)] font-semibold'
                      : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                  )}
                >
                  {tab.label}
                  {tab.count !== null && (
                    <span
                      className="data-mono text-[10px] h-4 px-1.5 flex items-center rounded-full"
                      style={{ background: 'var(--bg-inset)', color: 'var(--text-tertiary)' }}
                    >
                      {tab.count}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}

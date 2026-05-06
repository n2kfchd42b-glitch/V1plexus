'use client'

import Link from 'next/link'
import {
  Database, BarChart2, Clock, FileText, Settings, TrendingUp, ArrowRight, Target,
} from 'lucide-react'
import { ProjectGantt, type GanttPhase, type GanttNote } from '@/components/project/ProjectGantt'
import { useTranslations } from '@/i18n/useTranslations'

// ── Types ────────────────────────────────────────────────────────────────────

export interface OverviewActivityDay {
  dayIndex: number   // 0 = Sun … 6 = Sat
  count: number
  isToday: boolean
}

export interface ProjectOverviewClientProps {
  id: string
  project: { title: string; description: string | null; status: string }
  activityDays: OverviewActivityDay[]
  maxActivity: number
  completedCount: number
  nextMilestoneKey: string | null
  nextMilestoneStartDate: string | null
  datasetCount: number
  runCount: number
  auditCount: number
  initialPhases: GanttPhase[]
  initialNotes: GanttNote[]
  userId: string
}

// ── Phase label key map ───────────────────────────────────────────────────────

const PHASE_LABEL_KEYS: Record<string, string> = {
  concept:         'project.phase.concept',
  protocol:        'project.phase.protocol',
  ethics:          'project.phase.ethics_review',
  data_collection: 'project.phase.data',
  analysis:        'project.phase.analysis',
  writing:         'project.phase.writing',
  publication:     'project.phase.publication',
}

const DAY_KEYS = ['days.sun', 'days.mon', 'days.tue', 'days.wed', 'days.thu', 'days.fri', 'days.sat'] as const

// ── Status badge config ───────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; text: string; border: string; labelKey: string }> = {
  draft:     { bg: 'var(--bg-surface-active)',    text: 'var(--text-secondary)',        border: 'var(--border-default)',        labelKey: 'common.draft'                },
  active:    { bg: 'var(--accent-blue-subtle)',   text: 'var(--accent-blue)',            border: 'var(--border-status-info)',    labelKey: 'common.active'               },
  completed: { bg: 'var(--status-success-bg)',    text: 'var(--status-success-text)',    border: 'var(--border-status-success)', labelKey: 'project.status.completed'    },
  on_hold:   { bg: 'var(--status-warning-bg)',    text: 'var(--status-warning-text)',    border: 'var(--border-status-warning)', labelKey: 'project.status.on_hold'      },
  archived:  { bg: 'var(--bg-surface-active)',    text: 'var(--text-tertiary)',          border: 'var(--border-default)',        labelKey: 'project.status.archived'     },
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjectOverviewClient({
  id,
  project,
  activityDays,
  maxActivity,
  completedCount,
  nextMilestoneKey,
  nextMilestoneStartDate,
  datasetCount,
  runCount,
  auditCount,
  initialPhases,
  initialNotes,
  userId,
}: ProjectOverviewClientProps) {
  const { t } = useTranslations()

  const badge = STATUS_BADGE[project.status] ?? STATUS_BADGE.draft

  const quickLinks = [
    { href: `/projects/${id}/data`,     labelKey: 'nav.data',     icon: Database,  iconColor: 'var(--phase-data)',     count: datasetCount },
    { href: `/projects/${id}/analysis`, labelKey: 'nav.analysis', icon: BarChart2, iconColor: 'var(--accent-blue)',    count: runCount     },
    { href: `/projects/${id}/timeline`, labelKey: 'nav.timeline', icon: Clock,     iconColor: 'var(--status-warning)', count: auditCount   },
    { href: `/projects/${id}/report`,   labelKey: 'nav.report',   icon: FileText,  iconColor: 'var(--phase-writing)',  count: null as number | null },
    { href: `/projects/${id}/settings`, labelKey: 'nav.settings', icon: Settings,  iconColor: 'var(--text-tertiary)',  count: null as number | null },
  ]

  const remaining = 7 - completedCount

  return (
    <div className="flex flex-col" style={{ minHeight: '100%', background: 'var(--bg-app)' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-6 pt-6 pb-4"
        style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 rounded-full"
            style={{ width: 4, height: 32, background: 'var(--accent-blue)' }}
          />
          <h1
            className="tracking-tight leading-none"
            style={{
              color:      'var(--text-primary)',
              fontFamily: 'var(--font-manrope)',
              fontWeight:  800,
              fontSize:   '1.75rem',
            }}
          >
            {project.title}
          </h1>
        </div>
        {project.description && (
          <p
            className="text-sm mt-1.5 leading-relaxed"
            style={{ color: 'var(--text-secondary)', maxWidth: 560 }}
          >
            {project.description}
          </p>
        )}

        <div className="flex items-center gap-0 mt-3">
          <span
            className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold flex-shrink-0"
            style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}
          >
            {t(badge.labelKey)}
          </span>

          <span
            className="flex-shrink-0 mx-2.5"
            style={{ width: 1, height: 12, background: 'var(--border-default)', display: 'inline-block' }}
          />

          {quickLinks.map((link, i) => {
            const Icon = link.icon
            return (
              <span key={link.href} className="flex items-center">
                {i > 0 && (
                  <span
                    className="flex-shrink-0 mx-1.5"
                    style={{ width: 1, height: 12, background: 'var(--border-default)', display: 'inline-block' }}
                  />
                )}
                <Link
                  href={link.href}
                  className="flex items-center gap-1.5 px-1.5 py-1 rounded-md transition-all duration-150 opacity-50 hover:opacity-100 hover:bg-[var(--bg-surface-hover)]"
                >
                  <Icon className="h-3 w-3 flex-shrink-0" style={{ color: link.iconColor }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {t(link.labelKey)}
                  </span>
                  {link.count !== null && (
                    <span className="data-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      {link.count}
                    </span>
                  )}
                </Link>
              </span>
            )
          })}
        </div>
      </div>

      {/* ── Section: Timeline ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between mx-5 mt-5 mb-2">
        <span
          className="text-[10px] font-semibold uppercase"
          style={{ color: 'var(--text-tertiary)', letterSpacing: '0.07em' }}
        >
          {t('overview.sectionTimeline')}
        </span>
      </div>

      <div className="flex-shrink-0 mx-5 mb-3 mt-0" style={{ height: 460 }}>
        <div
          className="rounded-lg h-full flex flex-col"
          style={{
            border:     '1px solid var(--border-default)',
            background: 'var(--bg-surface)',
            boxShadow:  'var(--shadow-xs)',
            overflow:   'clip',
          }}
        >
          <ProjectGantt
            projectId={id}
            userId={userId}
            initialPhases={initialPhases}
            initialNotes={initialNotes}
          />
        </div>
      </div>

      {/* ── Section: At a Glance ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 mx-5 mb-2 mt-1">
        <span
          className="text-[10px] font-semibold uppercase"
          style={{ color: 'var(--text-tertiary)', letterSpacing: '0.07em' }}
        >
          {t('overview.sectionGlance')}
        </span>
      </div>

      <div className="flex gap-3 mx-5 mb-5 flex-shrink-0">

        {/* Activity bar chart */}
        <div
          className="flex-1 min-w-0 rounded-lg p-5"
          style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-xs)' }}
        >
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-manrope)' }}>
                {t('overview.activityThisWeek')}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {t('overview.auditEventsPerDay')}
              </p>
            </div>
            <TrendingUp className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <div className="flex items-end gap-2 mt-5" style={{ height: 80 }}>
            {activityDays.map((day, i) => {
              const barH = day.count === 0
                ? 6
                : Math.max(10, Math.round((day.count / maxActivity) * 56))
              return (
                <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                  <span
                    className="data-mono text-[9px]"
                    style={{ color: day.count > 0 ? 'var(--text-secondary)' : 'transparent' }}
                  >
                    {day.count || ''}
                  </span>
                  <div
                    className="w-full rounded-sm transition-all duration-300"
                    style={{
                      height:     barH,
                      background: day.count === 0
                        ? 'var(--bg-inset)'
                        : day.isToday
                        ? 'var(--accent-blue)'
                        : 'color-mix(in srgb, var(--accent-blue) 55%, transparent)',
                    }}
                  />
                  <span
                    className="data-mono text-[9px] font-semibold"
                    style={{ color: day.isToday ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}
                  >
                    {t(DAY_KEYS[day.dayIndex])}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Phase completion */}
        <div
          className="flex-shrink-0 rounded-lg p-4"
          style={{ width: 200, border: '1px solid var(--border-default)', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-xs)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.07em' }}>
              {t('overview.sectionPhases')}
            </p>
            <span className="data-mono text-[10px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
              {completedCount} / 7
            </span>
          </div>
          <div className="flex items-end gap-1 mb-3">
            <span className="data-mono font-bold leading-none" style={{ fontSize: 32, color: 'var(--text-primary)' }}>
              {Math.round((completedCount / 7) * 100)}
            </span>
            <span className="data-mono text-xl font-semibold mb-0.5" style={{ color: 'var(--text-tertiary)' }}>%</span>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: 'var(--bg-inset)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width:      `${(completedCount / 7) * 100}%`,
                background: completedCount === 7 ? 'var(--status-success)' : 'var(--accent-blue)',
              }}
            />
          </div>
          <p className="text-[10px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
            {completedCount === 7
              ? t('overview.allPhasesComplete')
              : `${remaining} ${t(remaining === 1 ? 'overview.phaseRemaining' : 'overview.phasesRemaining')}`}
          </p>
        </div>

        {/* Next phase */}
        <div
          className="flex-shrink-0 rounded-lg p-4 relative overflow-hidden flex flex-col"
          style={{ width: 200, background: 'var(--accent-primary)', boxShadow: 'var(--shadow-sm)' }}
        >
          <p className="text-[10px] font-semibold uppercase mb-2 flex-shrink-0" style={{ color: 'var(--text-inverse)', opacity: 0.5, letterSpacing: '0.07em' }}>
            {t('overview.nextPhase')}
          </p>

          {nextMilestoneKey ? (
            <>
              <div className="mb-1">
                <p className="font-bold text-sm leading-snug tracking-tight" style={{ color: 'var(--text-inverse)', fontFamily: 'var(--font-manrope)' }}>
                  {t(PHASE_LABEL_KEYS[nextMilestoneKey] ?? '', nextMilestoneKey)}
                </p>
              </div>
              <p className="text-[10px]" style={{ color: 'var(--text-inverse)', opacity: 0.55 }}>
                {nextMilestoneStartDate
                  ? `${t('overview.starts')} ${nextMilestoneStartDate}`
                  : t('overview.noStartDate')}
              </p>
            </>
          ) : (
            <p className="font-bold text-sm" style={{ color: 'var(--text-inverse)', fontFamily: 'var(--font-manrope)' }}>
              {t('overview.allPhasesComplete')}
            </p>
          )}

          <div className="mt-auto pt-3">
            <Link
              href={`/projects/${id}/timeline`}
              className="flex items-center gap-1 text-[10px] font-semibold transition-opacity duration-150 hover:opacity-80"
              style={{ color: 'var(--text-inverse)', opacity: 0.7 }}
            >
              {t('overview.viewTimeline')}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <Target
            className="absolute pointer-events-none"
            style={{ width: 64, height: 64, right: -12, bottom: -12, color: 'rgba(255,255,255,0.06)' }}
          />
        </div>

      </div>
    </div>
  )
}

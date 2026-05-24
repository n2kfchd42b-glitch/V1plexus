'use client'

import Link from 'next/link'
import {
  ArrowRight, Database, BarChart2, FileText,
  GraduationCap, ArchiveRestore, Sparkles,
} from 'lucide-react'

interface NextActionCardProps {
  projectId: string
  status: string
  isThesis: boolean
  datasetCount: number
  runCount: number
  hasDocs: boolean
  currentPhase: string | null
  chaptersTotal?: number
  chaptersApproved?: number
}

interface Suggestion {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
  href: string
  cta: string
}

function pickSuggestion(p: NextActionCardProps): Suggestion | null {
  if (p.status === 'archived') {
    return {
      icon: ArchiveRestore,
      title: 'This project is archived',
      body: 'Unarchive it from the project menu to start adding new work.',
      href: `/projects/${p.projectId}/settings`,
      cta: 'Open settings',
    }
  }

  if (p.isThesis && (p.chaptersTotal ?? 0) === 0) {
    return {
      icon: GraduationCap,
      title: 'Set up your chapters',
      body: 'Define the chapter structure so your writing has a clear scaffold.',
      href: `/projects/${p.projectId}/chapters`,
      cta: 'Open chapters',
    }
  }

  if (p.datasetCount === 0) {
    return {
      icon: Database,
      title: 'Add your first dataset',
      body: 'Bring in the data you plan to analyze. Spreadsheets, CSV, or SPSS files work.',
      href: `/projects/${p.projectId}/data`,
      cta: 'Add data',
    }
  }

  if (p.runCount === 0) {
    return {
      icon: BarChart2,
      title: 'Run your first analysis',
      body: 'Descriptive stats, regressions, group comparisons — pick the question you want to answer.',
      href: `/projects/${p.projectId}/analysis/new`,
      cta: 'Start analysis',
    }
  }

  if (!p.hasDocs) {
    return {
      icon: FileText,
      title: 'Start writing your report',
      body: 'Pull your findings into a document. Tables and charts can link back to the analysis runs.',
      href: `/projects/${p.projectId}/documents`,
      cta: 'Open writing',
    }
  }

  if (p.isThesis && p.currentPhase === 'writing') {
    const remaining = (p.chaptersTotal ?? 0) - (p.chaptersApproved ?? 0)
    if (remaining > 0) {
      return {
        icon: GraduationCap,
        title: `${remaining} chapter${remaining === 1 ? '' : 's'} still to approve`,
        body: 'Once your supervisor signs off on the remaining chapters, you can schedule the defense.',
        href: `/projects/${p.projectId}/chapters`,
        cta: 'Open chapters',
      }
    }
    return {
      icon: GraduationCap,
      title: 'Chapters look approved — schedule your defense',
      body: 'Lock in a date, confirm the committee, and prep the final submission.',
      href: `/projects/${p.projectId}/defense`,
      cta: 'Open defense',
    }
  }

  return null
}

export function NextActionCard(props: NextActionCardProps) {
  const suggestion = pickSuggestion(props)
  if (!suggestion) return null
  const { icon: Icon, title, body, href, cta } = suggestion

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 flex items-start gap-4">
      <div className="h-10 w-10 rounded-lg bg-[var(--accent-blue-subtle)] flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-[var(--accent-blue)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Sparkles className="h-3 w-3 text-[var(--accent-blue)]" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-blue)]">Next up</p>
        </div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug">{title}</h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{body}</p>
      </div>
      <Link
        href={href}
        className="flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-white btn-press btn-primary"
      >
        {cta}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

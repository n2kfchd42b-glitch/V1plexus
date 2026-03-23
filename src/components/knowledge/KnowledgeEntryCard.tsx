'use client'

import { FileText, Database, BarChart2, GraduationCap, FileCode2, ClipboardList } from 'lucide-react'
import { UseAsTemplateButton } from './UseAsTemplateButton'
import { ReproduceAnalysisButton } from './ReproduceAnalysisButton'
import { formatDate } from '@/lib/utils'
import type { KnowledgeBaseEntry } from '@/types/database'

interface KnowledgeEntryCardProps {
  entry: KnowledgeBaseEntry
}

const typeConfig = {
  protocol:        { icon: ClipboardList, label: 'Protocol',     color: 'text-blue-500',    bg: 'bg-blue-50' },
  manuscript:      { icon: FileText,       label: 'Manuscript',   color: 'text-violet-500',  bg: 'bg-violet-50' },
  dataset:         { icon: Database,       label: 'Dataset',      color: 'text-emerald-500', bg: 'bg-emerald-50' },
  analysis_config: { icon: BarChart2,      label: 'Analysis',     color: 'text-orange-500',  bg: 'bg-orange-50' },
  thesis:          { icon: GraduationCap,  label: 'Thesis',       color: 'text-pink-500',    bg: 'bg-pink-50' },
  template:        { icon: FileCode2,      label: 'Template',     color: 'text-teal-500',    bg: 'bg-teal-50' },
  sop:             { icon: FileText,       label: 'SOP',          color: 'text-amber-500',   bg: 'bg-amber-50' },
  report:          { icon: FileText,       label: 'Report',       color: 'text-gray-500',    bg: 'bg-gray-50' },
}

export function KnowledgeEntryCard({ entry }: KnowledgeEntryCardProps) {
  const config = typeConfig[entry.resource_type] ?? typeConfig.report
  const Icon = config.icon
  const authors = entry.authors?.map((a: { name: string }) => a.name).join(', ')

  return (
    <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] transition-colors group">
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 h-9 w-9 rounded-lg ${config.bg} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${config.color}`}>
              {config.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug mb-1">
            {entry.title}
          </h3>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)] mb-2">
            {authors && <span>{authors}</span>}
            {entry.archived_at && <span>· {new Date(entry.archived_at).getFullYear()}</span>}
            {entry.disease_area?.length > 0 && <span>· {entry.disease_area.slice(0, 2).join(', ')}</span>}
            {entry.methodology?.length > 0 && <span>· {entry.methodology[0]}</span>}
            {entry.geographic_scope?.length > 0 && <span>· {entry.geographic_scope[0]}</span>}
          </div>

          {entry.description && (
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2">{entry.description}</p>
          )}

          {/* Keywords */}
          {entry.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {entry.keywords.slice(0, 4).map(k => (
                <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-inset)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]">
                  {k}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {entry.resource_type === 'analysis_config' && (
              <ReproduceAnalysisButton entryId={entry.id} resourceId={entry.resource_id} />
            )}
            {(entry.resource_type === 'protocol' || entry.resource_type === 'template' || entry.is_template) && (
              <UseAsTemplateButton entry={entry} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

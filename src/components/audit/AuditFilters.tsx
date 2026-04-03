"use client"

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'

export interface AuditFilterValues {
  search: string
  action: string
  resourceType: string
  dateFrom: string
  dateTo: string
}

interface AuditFiltersProps {
  filters: AuditFilterValues
  onChange: (filters: AuditFilterValues) => void
}

const ACTIONS = [
  'dataset.imported', 'dataset.deleted', 'dataset.archived', 'dataset.unarchived',
  'dataset.version.committed', 'dataset.duplicates.resolved', 'dataset.reentry.validated',
  'dataset.imputation.mice', 'dataset.approved',
  'dataset.approval.requested', 'dataset.approval.rejected', 'dataset.approval.revision_requested',
  'dataset.verification.token_created',
  'analysis.run.saved', 'analysis.run.deleted', 'analysis.run.completed', 'analysis.run.failed',
  'analysis.assumption.acknowledged',
  'output.checklist.generated', 'output.methods.generated', 'output.package.generated',
  'document.created', 'document.deleted', 'document.edited', 'document.generated', 'document.exported', 'document.submitted',
  'project.created', 'project.updated', 'project.archived', 'project.deleted',
  'project.member.added', 'project.member.removed',
]

const RESOURCE_TYPES = ['dataset', 'dataset_version', 'analysis_run', 'document', 'project', 'profile']

export function AuditFilters({ filters, onChange }: AuditFiltersProps) {
  const update = (patch: Partial<AuditFilterValues>) => onChange({ ...filters, ...patch })

  const hasFilters = filters.search || filters.action || filters.resourceType || filters.dateFrom || filters.dateTo

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={filters.search}
          onChange={e => update({ search: e.target.value })}
          className="pl-8 h-8 text-xs w-44"
        />
      </div>

      <Select value={filters.action || '_all'} onValueChange={v => update({ action: v === '_all' ? '' : v })}>
        <SelectTrigger className="h-8 text-xs w-44">
          <SelectValue placeholder="All actions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All actions</SelectItem>
          {ACTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.resourceType || '_all'} onValueChange={v => update({ resourceType: v === '_all' ? '' : v })}>
        <SelectTrigger className="h-8 text-xs w-36">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All types</SelectItem>
          {RESOURCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={filters.dateFrom}
        onChange={e => update({ dateFrom: e.target.value })}
        className="h-8 text-xs w-36"
        title="From date"
      />
      <Input
        type="date"
        value={filters.dateTo}
        onChange={e => update({ dateTo: e.target.value })}
        className="h-8 text-xs w-36"
        title="To date"
      />

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => onChange({ search: '', action: '', resourceType: '', dateFrom: '', dateTo: '' })}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}

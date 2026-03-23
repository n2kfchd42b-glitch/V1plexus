'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { KBResourceType } from '@/types/database'

export interface KBFilters {
  type: KBResourceType | 'all'
  diseaseArea: string
  methodology: string
  year: string
}

interface KnowledgeBaseFiltersProps {
  filters: KBFilters
  onChange: (filters: KBFilters) => void
}

export function KnowledgeBaseFilters({ filters, onChange }: KnowledgeBaseFiltersProps) {
  const set = (key: keyof KBFilters) => (value: string) =>
    onChange({ ...filters, [key]: value })

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={filters.type} onValueChange={set('type')}>
        <SelectTrigger className="h-8 text-xs w-36">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="protocol">Protocol</SelectItem>
          <SelectItem value="manuscript">Manuscript</SelectItem>
          <SelectItem value="dataset">Dataset</SelectItem>
          <SelectItem value="analysis_config">Analysis</SelectItem>
          <SelectItem value="thesis">Thesis</SelectItem>
          <SelectItem value="template">Template</SelectItem>
          <SelectItem value="sop">SOP</SelectItem>
          <SelectItem value="report">Report</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.diseaseArea} onValueChange={set('diseaseArea')}>
        <SelectTrigger className="h-8 text-xs w-40">
          <SelectValue placeholder="Disease Area" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All areas</SelectItem>
          <SelectItem value="malaria">Malaria</SelectItem>
          <SelectItem value="tuberculosis">Tuberculosis</SelectItem>
          <SelectItem value="hiv">HIV/AIDS</SelectItem>
          <SelectItem value="maternal">Maternal Health</SelectItem>
          <SelectItem value="nutrition">Nutrition</SelectItem>
          <SelectItem value="child">Child Health</SelectItem>
          <SelectItem value="ncd">NCDs</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.methodology} onValueChange={set('methodology')}>
        <SelectTrigger className="h-8 text-xs w-44">
          <SelectValue placeholder="Methodology" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All methodologies</SelectItem>
          <SelectItem value="cross-sectional">Cross-sectional</SelectItem>
          <SelectItem value="rct">RCT</SelectItem>
          <SelectItem value="cohort">Cohort</SelectItem>
          <SelectItem value="case-control">Case-control</SelectItem>
          <SelectItem value="qualitative">Qualitative</SelectItem>
          <SelectItem value="mixed-methods">Mixed Methods</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.year} onValueChange={set('year')}>
        <SelectTrigger className="h-8 text-xs w-28">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All years</SelectItem>
          <SelectItem value="2026">2026</SelectItem>
          <SelectItem value="2025">2025</SelectItem>
          <SelectItem value="2024">2024</SelectItem>
          <SelectItem value="2023">2023</SelectItem>
          <SelectItem value="2022">2022</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

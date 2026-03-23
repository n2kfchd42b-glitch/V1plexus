'use client'

import { FileText, Zap, FileCheck2, Download, RefreshCw, Building2 } from 'lucide-react'
import { NETWORK_COMPLIANCE_ENABLED } from '@/lib/flags'

const FEATURES = [
  {
    icon: Zap,
    label: 'AI-Assisted Generation',
    description: 'Auto-fill DMPs from actual project data: dataset schemas, storage details, access controls, ethics status, and sharing settings.',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
  },
  {
    icon: Building2,
    label: 'Funder Templates',
    description: 'Ready-made templates for NIH, Wellcome Trust, ERC, Gates Foundation, and Horizon Europe — formatted to each funder\'s exact requirements.',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    icon: FileCheck2,
    label: 'Editable Output',
    description: 'Generated DMPs are saved as editable PLEXUS documents. Researchers review, refine, and add context before submission.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Download,
    label: 'PDF Export',
    description: 'Export the final DMP as a PDF in the funder\'s required format, ready to upload to grant portals.',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
  },
  {
    icon: RefreshCw,
    label: 'Living Plans',
    description: 'Update DMPs as your project evolves — data collection expands, new datasets are added, or sharing plans change.',
    color: 'text-cyan-500',
    bg: 'bg-cyan-50',
  },
]

export default function DMPPage() {
  if (NETWORK_COMPLIANCE_ENABLED) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--text-secondary)]" />
            <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Data Management Plans</h1>
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            Generate funder-specific data management plans from your project data
          </p>
        </div>
        <div className="flex items-center justify-center h-64 text-[var(--text-tertiary)] text-sm">
          DMP generator coming soon.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-amber-50 mb-4">
          <FileText className="h-6 w-6 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Data Management Plans</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          AI-assisted DMP generation, pre-filled from your actual project data, in the exact format each funder requires.
        </p>
      </div>

      <div className="space-y-3">
        {FEATURES.map(f => {
          const Icon = f.icon
          return (
            <div
              key={f.label}
              className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl bg-white"
            >
              <div className={`flex-shrink-0 h-9 w-9 rounded-lg ${f.bg} flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${f.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{f.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{f.description}</p>
              </div>
              <span className="ml-auto flex-shrink-0 text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full h-fit mt-0.5">
                Soon
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400 mt-8">
        Supports NIH, Wellcome Trust, ERC, Gates Foundation, and Horizon Europe formats.
      </p>
    </div>
  )
}

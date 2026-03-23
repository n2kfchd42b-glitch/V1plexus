'use client'

// Phase 11: Institutional Knowledge Base
// To enable: set INSTITUTIONAL_INTELLIGENCE_ENABLED = true in src/lib/flags.ts

import { BookOpen, Search, Sparkles, RefreshCw } from 'lucide-react'
import { INSTITUTIONAL_INTELLIGENCE_ENABLED } from '@/lib/flags'
import { KnowledgeBaseSearch } from '@/components/knowledge/KnowledgeBaseSearch'

const FEATURES = [
  {
    icon: Search,
    label: 'Full-Text Search',
    description: 'Search protocols, datasets, analyses, theses, and reports across all archived projects',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    icon: Sparkles,
    label: 'AI Similarity Discovery',
    description: 'Automatically surfaces similar studies when starting a new project',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
  },
  {
    icon: BookOpen,
    label: 'Template Library',
    description: 'Use archived protocols as starting templates for new studies',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: RefreshCw,
    label: 'Reproducible Analyses',
    description: 'Clone analysis configurations from past studies and run them on new data',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
]

export default function KnowledgePage() {
  if (INSTITUTIONAL_INTELLIGENCE_ENABLED) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            Searchable repository of all archived research artifacts — protocols, datasets, analyses, and theses
          </p>
        </div>
        <KnowledgeBaseSearch />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gray-100 mb-4">
          <BookOpen className="h-6 w-6 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Institutional Knowledge Base</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          Searchable repository of all archived research artifacts with AI-powered similarity discovery. Coming soon.
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
        Projects are auto-archived to the knowledge base when marked as completed.
      </p>
    </div>
  )
}

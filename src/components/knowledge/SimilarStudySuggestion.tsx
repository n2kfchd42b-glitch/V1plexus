'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { KnowledgeEntryCard } from './KnowledgeEntryCard'
import type { KnowledgeBaseEntry } from '@/types/database'

interface SimilarStudySuggestionProps {
  projectTitle?: string
  projectId?: string
  diseaseAreas?: string[]
  methodologies?: string[]
}

export function SimilarStudySuggestion({ projectTitle, diseaseAreas, methodologies }: SimilarStudySuggestionProps) {
  const { profile } = useAuth()
  const supabase = createClient()
  const [similar, setSimilar] = useState<KnowledgeBaseEntry[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!profile?.institution_id) return
    if (!diseaseAreas?.length && !methodologies?.length) return

    setLoading(true)
    const query = supabase
      .from('knowledge_base_entries')
      .select('*')
      .eq('institution_id', profile.institution_id)
      .limit(3)

    // Filter by overlapping disease areas or methodology
    if (diseaseAreas?.length) {
      query.overlaps('disease_area', diseaseAreas)
    }

    query.then(({ data }) => {
      if (data) setSimilar(data as KnowledgeBaseEntry[])
      setLoading(false)
    })
  }, [profile, supabase, diseaseAreas, methodologies])

  if (loading || similar.length === 0) return null

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold text-violet-800 dark:text-violet-300">AI Suggestions</span>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-violet-600 flex items-center gap-0.5"
        >
          {expanded ? 'Hide' : 'Show'} {similar.length} similar
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      <p className="text-xs text-violet-700 dark:text-violet-300">
        {similar.length} previous {similar.length === 1 ? 'study' : 'studies'} at your institution{' '}
        {projectTitle ? `used methodology similar to "${projectTitle}"` : 'match your research profile'}.
        {similar.length > 0 && ` The most relevant is "${similar[0].title}" (${new Date(similar[0].archived_at).getFullYear()}).`}
      </p>

      {expanded && (
        <div className="space-y-2 pt-1">
          {similar.map(entry => (
            <KnowledgeEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}

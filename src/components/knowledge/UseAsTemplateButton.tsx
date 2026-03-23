'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { KnowledgeBaseEntry } from '@/types/database'

interface UseAsTemplateButtonProps {
  entry: KnowledgeBaseEntry
}

export function UseAsTemplateButton({ entry }: UseAsTemplateButtonProps) {
  const { profile } = useAuth()
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleUseAsTemplate = async () => {
    if (!profile) return
    setLoading(true)

    try {
      // Fetch the source document
      const { data: sourceDoc } = await supabase
        .from('documents')
        .select('*')
        .eq('id', entry.resource_id)
        .single()

      if (!sourceDoc) {
        toast.error('Source document not found in knowledge base.')
        setLoading(false)
        return
      }

      // Create new document as a copy (template use)
      const { data: newDoc, error } = await supabase
        .from('documents')
        .insert({
          project_id: sourceDoc.project_id,
          title: `[Template] ${entry.title}`,
          type: sourceDoc.type,
          content: sourceDoc.content,
          status: 'draft',
          created_by: profile.id,
          version: 1,
        })
        .select('id, project_id')
        .single()

      if (error || !newDoc) {
        toast.error('Failed to create document from template.')
        setLoading(false)
        return
      }

      toast.success('Document created from template. Opening editor…')
      router.push(`/projects/${newDoc.project_id}/documents/${newDoc.id}`)
    } catch {
      toast.error('Unexpected error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleUseAsTemplate}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
    >
      <Copy className="h-3 w-3" />
      {loading ? 'Creating…' : 'Use as Template'}
    </button>
  )
}

"use client"

import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, X, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CommentThread } from './CommentThread'
import { createClient } from '@/lib/supabase/client'
import type { DocumentComment, Profile } from '@/types/database'

interface CommentsSidebarProps {
  documentId: string
  currentProfile: Profile | null
  onClose: () => void
  pendingAnchorText?: string | null
  onClearPending?: () => void
}

export function CommentsSidebar({ documentId, currentProfile, onClose, pendingAnchorText, onClearPending }: CommentsSidebarProps) {
  const [comments, setComments] = useState<DocumentComment[]>([])
  const [showResolved, setShowResolved] = useState(false)
  const [newCommentText, setNewCommentText] = useState('')
  const [submittingNew, setSubmittingNew] = useState(false)
  const supabase = createClient()

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('document_comments')
      .select(`
        *,
        author:profiles!author_id(id, full_name, avatar_url)
      `)
      .eq('document_id', documentId)
      .is('parent_id', null)
      .order('created_at', { ascending: false })

    if (!data) return

    // Fetch replies for each comment
    const withReplies = await Promise.all(
      data.map(async (comment) => {
        const { data: replies } = await supabase
          .from('document_comments')
          .select(`*, author:profiles!author_id(id, full_name, avatar_url)`)
          .eq('parent_id', comment.id)
          .order('created_at', { ascending: true })
        return { ...comment, replies: replies ?? [] }
      })
    )
    setComments(withReplies)
  }, [documentId, supabase])

  useEffect(() => { fetchComments() }, [fetchComments])

  const handleAddComment = async () => {
    if (!newCommentText.trim() || !currentProfile) return
    setSubmittingNew(true)
    await supabase.from('document_comments').insert({
      document_id: documentId,
      author_id: currentProfile.id,
      content: newCommentText.trim(),
      anchor_text: pendingAnchorText ?? null,
      parent_id: null,
    })
    setNewCommentText('')
    onClearPending?.()
    setSubmittingNew(false)
    fetchComments()
  }

  const handleResolve = async (id: string) => {
    if (!currentProfile) return
    await supabase
      .from('document_comments')
      .update({
        is_resolved: true,
        resolved_by: currentProfile.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)
    fetchComments()
  }

  const filtered = showResolved
    ? comments
    : comments.filter(c => !c.is_resolved)

  const unresolvedCount = comments.filter(c => !c.is_resolved).length

  return (
    <div className="w-80 border-l bg-card flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span className="font-semibold text-sm">Comments</span>
          {unresolvedCount > 0 && (
            <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-medium">
              {unresolvedCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowResolved(!showResolved)}
          >
            <Filter className="h-3 w-3 mr-1" />
            {showResolved ? 'Hide resolved' : 'Show resolved'}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Compose new comment */}
      {pendingAnchorText && (
        <div className="p-3 border-b bg-yellow-50/60 space-y-2">
          <div className="px-2 py-1 bg-yellow-100 border-l-2 border-yellow-400 text-xs text-muted-foreground italic rounded-r">
            &ldquo;{pendingAnchorText.slice(0, 100)}{pendingAnchorText.length > 100 ? '…' : ''}&rdquo;
          </div>
          <textarea
            autoFocus
            placeholder="Add your comment…"
            value={newCommentText}
            onChange={e => setNewCommentText(e.target.value)}
            rows={3}
            className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
          <div className="flex gap-1.5 justify-end">
            <button
              onClick={() => { setNewCommentText(''); onClearPending?.() }}
              className="px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddComment}
              disabled={submittingNew || !newCommentText.trim()}
              className="px-2 py-1 text-xs rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {submittingNew ? 'Saving…' : 'Comment'}
            </button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="py-8 text-center">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No comments yet</p>
              <p className="text-xs text-muted-foreground mt-1">Select text to add a comment</p>
            </div>
          ) : (
            filtered.map(comment => (
              <CommentThread
                key={comment.id}
                comment={comment}
                currentProfile={currentProfile}
                onResolve={handleResolve}
                onRefresh={fetchComments}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

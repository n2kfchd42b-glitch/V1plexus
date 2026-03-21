"use client"

import { useState } from 'react'
import { CheckCircle, Reply, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn, formatRelative, getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { DocumentComment, Profile } from '@/types/database'

interface CommentThreadProps {
  comment: DocumentComment
  currentProfile: Profile | null
  onResolve: (id: string) => void
  onRefresh: () => void
}

export function CommentThread({ comment, currentProfile, onResolve, onRefresh }: CommentThreadProps) {
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  const handleReply = async () => {
    if (!replyText.trim() || !currentProfile) return
    setSubmitting(true)
    await supabase.from('document_comments').insert({
      document_id: comment.document_id,
      author_id: currentProfile.id,
      content: replyText.trim(),
      parent_id: comment.id,
    })
    setReplyText('')
    setShowReply(false)
    setSubmitting(false)
    onRefresh()
  }

  return (
    <div className={cn('rounded-lg border p-3 text-sm', comment.is_resolved && 'opacity-60 bg-muted/50')}>
      {/* Anchor text */}
      {comment.anchor_text && (
        <div className="mb-2 px-2 py-1 bg-yellow-50 border-l-2 border-yellow-400 text-xs text-muted-foreground italic rounded-r">
          &ldquo;{comment.anchor_text.slice(0, 80)}{comment.anchor_text.length > 80 ? '…' : ''}&rdquo;
        </div>
      )}

      {/* Comment */}
      <div className="flex items-start gap-2">
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarFallback className="text-xs">{getInitials(comment.author?.full_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-xs">{comment.author?.full_name ?? 'Unknown'}</span>
            <span className="text-xs text-muted-foreground">{formatRelative(comment.created_at)}</span>
            {comment.is_resolved && <span className="text-xs text-green-600 font-medium">Resolved</span>}
          </div>
          <p className="mt-0.5 text-sm">{comment.content}</p>

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2 space-y-2 pl-2 border-l-2 border-muted">
              {comment.replies.map(reply => (
                <div key={reply.id} className="flex items-start gap-2">
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarFallback className="text-xs">{getInitials(reply.author?.full_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium text-xs">{reply.author?.full_name ?? 'Unknown'}</span>
                    <span className="text-xs text-muted-foreground ml-1">{formatRelative(reply.created_at)}</span>
                    <p className="text-xs mt-0.5">{reply.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {!comment.is_resolved && (
            <div className="flex items-center gap-1 mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setShowReply(!showReply)}
              >
                <Reply className="h-3 w-3 mr-1" />
                Reply
              </Button>
              {(currentProfile?.id === comment.author_id || currentProfile?.role === 'pi' || currentProfile?.role === 'coordinator' || currentProfile?.role === 'admin') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-green-600 hover:text-green-700"
                  onClick={() => onResolve(comment.id)}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Resolve
                </Button>
              )}
            </div>
          )}

          {showReply && (
            <div className="mt-2 space-y-2">
              <Textarea
                placeholder="Write a reply..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={2}
                className="text-xs"
              />
              <div className="flex gap-1">
                <Button size="sm" className="h-6 text-xs" onClick={handleReply} disabled={submitting || !replyText.trim()}>
                  Reply
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowReply(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

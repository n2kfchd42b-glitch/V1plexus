"use client"

import { useState, useEffect } from 'react'
import { ArrowLeft, FileText, User, Calendar, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { FeedbackForm } from './FeedbackForm'
import { CommentThread } from '@/components/document/CommentThread'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, formatRelative, getInitials, priorityColor, statusColor, statusLabel } from '@/lib/utils'
import type { ReviewRequest, ReviewComment, Profile } from '@/types/database'

interface ReviewWorkspaceProps {
  reviewId: string
  currentProfile: Profile | null
}

export function ReviewWorkspace({ reviewId, currentProfile }: ReviewWorkspaceProps) {
  const [review, setReview] = useState<ReviewRequest | null>(null)
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchReview = async () => {
    const { data } = await supabase
      .from('review_requests')
      .select(`
        *,
        document:documents(*),
        requester:profiles!requested_by(id, full_name, avatar_url),
        reviewer:profiles!assigned_to(id, full_name, avatar_url)
      `)
      .eq('id', reviewId)
      .single()

    if (data) setReview(data as ReviewRequest)

    const { data: reviewComments } = await supabase
      .from('review_comments')
      .select(`*, author:profiles!author_id(id, full_name, avatar_url)`)
      .eq('review_id', reviewId)
      .is('parent_id', null)
      .order('created_at', { ascending: true })

    if (reviewComments) setComments(reviewComments)
    setLoading(false)
  }

  useEffect(() => { fetchReview() }, [reviewId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground text-sm">Loading review...</div>
      </div>
    )
  }

  if (!review) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground text-sm">Review not found</div>
      </div>
    )
  }

  // Group comments by section
  const bySection = comments.reduce<Record<string, ReviewComment[]>>((acc, c) => {
    const key = c.section_key ?? 'General'
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg">{review.document?.title ?? 'Untitled Document'}</h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {review.requester?.full_name}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatRelative(review.created_at)}
              </span>
              {review.due_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Due {formatDate(review.due_date)}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Badge className={cn('text-xs border', priorityColor(review.priority))}>
              {review.priority}
            </Badge>
            <Badge className={cn('text-xs border', statusColor(review.status))}>
              {statusLabel(review.status)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Document Preview */}
        <div className="flex-1 overflow-y-auto">
          <ScrollArea className="h-full">
            {review.document?.content ? (
              <div className="p-8 prose prose-sm max-w-none">
                <DocumentRenderer content={review.document.content} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                <FileText className="h-8 w-8 mr-2 opacity-50" />
                No document content
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Feedback Panel */}
        <div className="w-96 border-l bg-card flex flex-col">
          <Tabs defaultValue="feedback" className="flex flex-col h-full">
            <TabsList className="m-3 mb-0">
              <TabsTrigger value="feedback" className="flex-1 text-xs">Feedback</TabsTrigger>
              <TabsTrigger value="comments" className="flex-1 text-xs">
                Comments ({comments.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="feedback" className="flex-1 overflow-y-auto mt-0">
              <FeedbackForm
                review={review}
                currentProfile={currentProfile}
                onUpdate={fetchReview}
              />
            </TabsContent>

            <TabsContent value="comments" className="flex-1 overflow-y-auto mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {Object.keys(bySection).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No section comments yet
                    </p>
                  ) : (
                    Object.entries(bySection).map(([section, sectionComments]) => (
                      <div key={section}>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          {section}
                        </h4>
                        <div className="space-y-2">
                          {sectionComments.map(comment => (
                            <div key={comment.id} className="p-3 bg-muted/50 rounded-lg text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className="text-xs">
                                    {getInitials(comment.author?.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-xs">{comment.author?.full_name}</span>
                                <span className="text-xs text-muted-foreground">{formatRelative(comment.created_at)}</span>
                              </div>
                              <p className="text-xs">{comment.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

// Simple document renderer that converts TipTap JSON to readable text
function DocumentRenderer({ content }: { content: Record<string, unknown> }) {
  const renderNode = (node: Record<string, unknown>, key: number): React.ReactNode => {
    const type = node.type as string
    const children = (node.content as Record<string, unknown>[] | undefined)?.map((child, i) =>
      renderNode(child, i)
    )
    const text = node.text as string | undefined
    const marks = node.marks as Array<{ type: string }> | undefined

    if (type === 'text') {
      let el: React.ReactNode = text
      if (marks) {
        marks.forEach(mark => {
          if (mark.type === 'bold') el = <strong key={key}>{el}</strong>
          if (mark.type === 'italic') el = <em key={key}>{el}</em>
          if (mark.type === 'code') el = <code key={key}>{el}</code>
        })
      }
      return el
    }

    switch (type) {
      case 'doc': return <div key={key}>{children}</div>
      case 'paragraph': return <p key={key}>{children}</p>
      case 'heading': return <h3 key={key} className="font-bold">{children}</h3>
      case 'bulletList': return <ul key={key} className="list-disc pl-4">{children}</ul>
      case 'orderedList': return <ol key={key} className="list-decimal pl-4">{children}</ol>
      case 'listItem': return <li key={key}>{children}</li>
      case 'blockquote': return <blockquote key={key} className="border-l-4 pl-4 italic">{children}</blockquote>
      case 'codeBlock': return <pre key={key} className="bg-muted p-2 rounded"><code>{children}</code></pre>
      case 'horizontalRule': return <hr key={key} />
      default: return <span key={key}>{children ?? text}</span>
    }
  }

  return <>{renderNode(content, 0)}</>
}

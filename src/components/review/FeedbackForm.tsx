"use client"

import { useState } from 'react'
import { CheckCircle, XCircle, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { getDocumentForAudit, updateDocumentStatus } from '@/lib/data'
import { logAudit } from '@/lib/audit'
import type { ReviewRequest, Profile } from '@/types/database'

interface FeedbackFormProps {
  review: ReviewRequest
  currentProfile: Profile | null
  onUpdate: () => void
}

export function FeedbackForm({ review, currentProfile, onUpdate }: FeedbackFormProps) {
  const [feedback, setFeedback] = useState(review.feedback_text ?? '')
  const [commentText, setCommentText] = useState('')
  const [sectionKey, setSectionKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  const isReviewer = currentProfile?.id === review.assigned_to

  const updateStatus = async (status: string) => {
    setSubmitting(true)
    await supabase
      .from('review_requests')
      .update({
        status,
        feedback_text: feedback || null,
        ...(status === 'in_review' && !review.started_at ? { started_at: new Date().toISOString() } : {}),
        ...(status === 'approved' || status === 'rejected' || status === 'feedback_given'
          ? { completed_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', review.id)

    // Update document status + audit the transition
    const docResult = await getDocumentForAudit(supabase, review.document_id)
    const projectId = docResult.data?.project_id ?? undefined
    const docTitle = docResult.data?.title ?? review.document_id

    if (status === 'approved') {
      await updateDocumentStatus(supabase, review.document_id, 'approved')
      await logAudit('document.approved', 'document', review.document_id, {
        summary: `Approved "${docTitle}"`,
        operation: { review_id: review.id, feedback: feedback || null },
        approval_note: feedback || undefined,
      }, projectId)
    } else if (status === 'feedback_given') {
      await updateDocumentStatus(supabase, review.document_id, 'revision_requested')
      await logAudit('document.revision_requested', 'document', review.document_id, {
        summary: `Requested revision on "${docTitle}"`,
        operation: { review_id: review.id, feedback: feedback || null },
      }, projectId)
    } else if (status === 'rejected') {
      await logAudit('document.rejected', 'document', review.document_id, {
        summary: `Rejected "${docTitle}"`,
        operation: { review_id: review.id, feedback: feedback || null },
      }, projectId)
    }

    setSubmitting(false)
    onUpdate()
  }

  const addComment = async () => {
    if (!commentText.trim() || !currentProfile) return
    setSubmitting(true)
    await supabase.from('review_comments').insert({
      review_id: review.id,
      author_id: currentProfile.id,
      content: commentText.trim(),
      section_key: sectionKey || null,
    })
    setCommentText('')
    setSectionKey('')
    setSubmitting(false)
    onUpdate()
  }

  return (
    <div className="space-y-6 p-4">
      {/* Overall Feedback */}
      <div>
        <Label className="text-sm font-medium">Overall Feedback</Label>
        <Textarea
          placeholder="Write your overall feedback for the document..."
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          rows={5}
          className="mt-2"
          disabled={!isReviewer || review.status === 'approved' || review.status === 'rejected'}
        />
      </div>

      {/* Section Comment */}
      {isReviewer && review.status !== 'approved' && review.status !== 'rejected' && (
        <div>
          <Label className="text-sm font-medium">Add Section Comment</Label>
          <Input
            placeholder="Section (e.g. Introduction, Methods)"
            value={sectionKey}
            onChange={e => setSectionKey(e.target.value)}
            className="mt-2 mb-2"
          />
          <Textarea
            placeholder="Comment about this section..."
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            rows={3}
          />
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={addComment}
            disabled={submitting || !commentText.trim()}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Add Comment
          </Button>
        </div>
      )}

      {/* Action Buttons */}
      {isReviewer && review.status !== 'approved' && review.status !== 'rejected' && (
        <div className="flex gap-3 pt-2 border-t">
          {review.status === 'pending' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateStatus('in_review')}
              disabled={submitting}
            >
              Start Review
            </Button>
          )}
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => updateStatus('approved')}
            disabled={submitting}
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
            onClick={() => updateStatus('feedback_given')}
            disabled={submitting}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Request Revision
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50"
            onClick={() => updateStatus('rejected')}
            disabled={submitting}
          >
            <XCircle className="h-3.5 w-3.5 mr-1.5" />
            Reject
          </Button>
        </div>
      )}

      {review.status === 'approved' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-green-700 text-sm">
          <CheckCircle className="h-4 w-4" />
          Document approved
        </div>
      )}
      {review.status === 'rejected' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-red-700 text-sm">
          <XCircle className="h-4 w-4" />
          Document rejected
        </div>
      )}
    </div>
  )
}

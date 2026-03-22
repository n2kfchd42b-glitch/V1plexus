"use client"

import { useState, useEffect } from 'react'
import { Mail, Clock, Send, Calendar, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useWorkspaceContext } from '@/components/workspace/WorkspaceProvider'
import type { SupervisorAssignment, ReviewRequest } from '@/types/database'
import { cn } from '@/lib/utils'

export function MySupervisorPanel() {
  const { supervisorAssignment, activeWorkspace } = useWorkspaceContext()
  const [recentReviews, setRecentReviews] = useState<(ReviewRequest & { document?: { title: string } })[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!supervisorAssignment) return
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('review_requests')
        .select('*, document:documents(title)')
        .eq('requested_by', user.id)
        .order('created_at', { ascending: false })
        .limit(3)
      setRecentReviews((data ?? []) as (ReviewRequest & { document?: { title: string } })[])
    }
    load()
  }, [supervisorAssignment, supabase])

  if (!supervisorAssignment) {
    return (
      <div className="p-6 text-center text-[var(--text-tertiary)]">
        <p className="text-sm">No supervisor assigned yet.</p>
        <p className="text-xs mt-1">Your institution admin will assign a supervisor soon.</p>
      </div>
    )
  }

  const supervisor = supervisorAssignment.supervisor
  const department = supervisorAssignment.department

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-[var(--text-primary)] mb-6">My Supervisor</h1>

      {/* Supervisor Card */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-[#1B3A5C] flex items-center justify-center text-white font-bold flex-shrink-0">
            {supervisor?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? '??'}
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {supervisor?.full_name ?? 'Unknown'}
            </h2>
            {department && (
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                Department of {department.name}
              </p>
            )}
            {supervisor?.email && (
              <div className="flex items-center gap-1.5 mt-1.5 text-sm text-[var(--text-tertiary)]">
                <Mail className="h-3.5 w-3.5" />
                {supervisor.email}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-4 pt-4 border-t border-[var(--border-default)]">
          <Button size="sm" variant="outline" className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Send Message
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Request Meeting
          </Button>
          <Button size="sm" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Submit for Review
          </Button>
        </div>
      </div>

      {/* Recent Feedback */}
      {recentReviews.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Recent Feedback</h3>
          <div className="space-y-2">
            {recentReviews.map(review => (
              <div
                key={review.id}
                className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {review.document?.title ?? 'Document Review'}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    review.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : review.status === 'feedback_given'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                  )}>
                    {review.status.replace('_', ' ')}
                  </span>
                </div>
                {review.feedback_text && (
                  <p className="text-xs text-[var(--text-secondary)] mt-2 italic line-clamp-2">
                    &ldquo;{review.feedback_text}&rdquo;
                  </p>
                )}
                <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs px-2">
                  View Feedback →
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

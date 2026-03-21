"use client"

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClipboardList, CheckCircle } from 'lucide-react'
import { ReviewQueue } from '@/components/review/ReviewQueue'
import { ReviewWorkspace } from '@/components/review/ReviewWorkspace'
import { useAuth } from '@/hooks/useAuth'

export default function ReviewsPage() {
  const { profile } = useAuth()
  const searchParams = useSearchParams()
  const [activeReviewId, setActiveReviewId] = useState<string | null>(
    searchParams.get('id')
  )

  useEffect(() => {
    const id = searchParams.get('id')
    if (id) setActiveReviewId(id)
  }, [searchParams])

  return (
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden">
      <ReviewQueue
        currentProfile={profile}
        activeReviewId={activeReviewId}
        onSelectReview={setActiveReviewId}
      />

      <div className="flex-1 overflow-hidden border-l border-[var(--border-default)]">
        {activeReviewId ? (
          <ReviewWorkspace
            reviewId={activeReviewId}
            currentProfile={profile}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-[var(--bg-app)]">
            <div className="text-center">
              <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-[var(--bg-inset)] flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-[var(--text-tertiary)]" />
              </div>
              <p className="text-base font-semibold text-[var(--text-primary)] mb-1">Select a review</p>
              <p className="text-sm text-[var(--text-secondary)]">Choose a review from the queue to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

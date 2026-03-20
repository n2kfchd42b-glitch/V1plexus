"use client"

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
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
    <div className="flex h-screen overflow-hidden">
      <ReviewQueue
        currentProfile={profile}
        activeReviewId={activeReviewId}
        onSelectReview={setActiveReviewId}
      />

      <div className="flex-1 overflow-hidden">
        {activeReviewId ? (
          <ReviewWorkspace
            reviewId={activeReviewId}
            currentProfile={profile}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Select a review from the queue</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

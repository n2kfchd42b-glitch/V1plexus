"use client"

import { useState, useEffect } from 'react'
import { ClipboardList, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ReviewCard } from './ReviewCard'
import { createClient } from '@/lib/supabase/client'
import type { ReviewRequest, Profile } from '@/types/database'

interface ReviewQueueProps {
  currentProfile: Profile | null
  activeReviewId: string | null
  onSelectReview: (id: string) => void
}

export function ReviewQueue({ currentProfile, activeReviewId, onSelectReview }: ReviewQueueProps) {
  const [reviews, setReviews] = useState<ReviewRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const supabase = createClient()

  useEffect(() => {
    if (!currentProfile) return

    const fetchReviews = async () => {
      let query = supabase
        .from('review_requests')
        .select(`
          *,
          document:documents(id, title, status),
          requester:profiles!requested_by(id, full_name, avatar_url),
          reviewer:profiles!assigned_to(id, full_name, avatar_url)
        `)
        .order('created_at', { ascending: false })

      // Supervisors/admins see all reviews assigned to them; researchers see ones they submitted
      if (currentProfile.role === 'supervisor' || currentProfile.role === 'admin') {
        query = query.eq('assigned_to', currentProfile.id)
      } else {
        query = query.eq('requested_by', currentProfile.id)
      }

      const { data } = await query
      if (data) setReviews(data as ReviewRequest[])
      setLoading(false)
    }

    fetchReviews()

    // Realtime
    const channel = supabase
      .channel('review_queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'review_requests' }, () => {
        fetchReviews()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentProfile, supabase])

  const filtered = reviews.filter(r => {
    const matchesSearch = r.document?.title?.toLowerCase().includes(search.toLowerCase()) ||
      r.requester?.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="w-80 border-r bg-card flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="h-4 w-4" />
          <h2 className="font-semibold text-sm">Review Queue</h2>
          <span className="text-xs bg-muted rounded-full px-2 py-0.5 ml-auto">
            {filtered.length}
          </span>
        </div>
        <Input
          placeholder="Search reviews..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs mb-2"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="feedback_given">Feedback Given</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No reviews found</p>
          </div>
        ) : (
          <div>
            {filtered.map(review => (
              <ReviewCard
                key={review.id}
                review={review}
                isActive={review.id === activeReviewId}
                onClick={() => onSelectReview(review.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

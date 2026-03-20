"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  FolderOpen, FileText, ClipboardList, Bell,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelative, statusColor, statusLabel } from '@/lib/utils'
import type { Project, ReviewRequest } from '@/types/database'

interface DashboardStats {
  projects: number
  documents: number
  pendingReviews: number
  unreadNotifications: number
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({ projects: 0, documents: 0, pendingReviews: 0, unreadNotifications: 0 })
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [recentReviews, setRecentReviews] = useState<ReviewRequest[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!profile) return

    const fetchData = async () => {
      const [projectsRes, docsRes, reviewsRes, notifsRes, recentProjectsRes, recentReviewsRes] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact' }).eq('owner_id', profile.id),
        supabase.from('documents').select('id', { count: 'exact' }).eq('created_by', profile.id),
        supabase.from('review_requests').select('id', { count: 'exact' })
          .eq(profile.role === 'researcher' ? 'requested_by' : 'assigned_to', profile.id)
          .in('status', ['pending', 'in_review']),
        supabase.from('notifications').select('id', { count: 'exact' })
          .eq('user_id', profile.id).eq('is_read', false),
        supabase.from('projects').select('*').eq('owner_id', profile.id)
          .order('updated_at', { ascending: false }).limit(5),
        supabase.from('review_requests')
          .select(`*, document:documents(id, title), requester:profiles!requested_by(id, full_name)`)
          .eq(profile.role === 'researcher' ? 'requested_by' : 'assigned_to', profile.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      setStats({
        projects: projectsRes.count ?? 0,
        documents: docsRes.count ?? 0,
        pendingReviews: reviewsRes.count ?? 0,
        unreadNotifications: notifsRes.count ?? 0,
      })
      if (recentProjectsRes.data) setRecentProjects(recentProjectsRes.data)
      if (recentReviewsRes.data) setRecentReviews(recentReviewsRes.data as ReviewRequest[])
    }

    fetchData()
  }, [profile, supabase])

  const statCards = [
    { label: 'Projects', value: stats.projects, icon: FolderOpen, href: '/projects', color: 'text-blue-600' },
    { label: 'Documents', value: stats.documents, icon: FileText, href: '/projects', color: 'text-purple-600' },
    { label: 'Pending Reviews', value: stats.pendingReviews, icon: ClipboardList, href: '/reviews', color: 'text-orange-600' },
    { label: 'Unread Notifications', value: stats.unreadNotifications, icon: Bell, href: '/notifications', color: 'text-red-600' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Welcome back, {profile?.full_name?.split(' ')[0] ?? 'Researcher'}</h1>
        <p className="text-muted-foreground text-sm mt-1 capitalize">{profile?.role} · PLEXUS Research Lab</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(stat => {
          const Icon = stat.icon
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={cn('h-5 w-5', stat.color)} />
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Projects</CardTitle>
              <Link href="/projects">
                <Button variant="ghost" size="sm" className="h-7 text-xs">View all</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <div className="text-center py-6">
                <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No projects yet</p>
                <Link href="/projects">
                  <Button size="sm" className="mt-3">Create Project</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentProjects.map(project => (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{project.title}</p>
                        <p className="text-xs text-muted-foreground">{formatRelative(project.updated_at)}</p>
                      </div>
                      <Badge className={cn('text-xs border ml-2 shrink-0', statusColor(project.status))}>
                        {statusLabel(project.status)}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Reviews */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Reviews</CardTitle>
              <Link href="/reviews">
                <Button variant="ghost" size="sm" className="h-7 text-xs">View all</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentReviews.length === 0 ? (
              <div className="text-center py-6">
                <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No reviews yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentReviews.map(review => (
                  <Link key={review.id} href={`/reviews?id=${review.id}`}>
                    <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{review.document?.title ?? 'Untitled'}</p>
                        <p className="text-xs text-muted-foreground">{formatRelative(review.created_at)}</p>
                      </div>
                      <Badge className={cn('text-xs border ml-2 shrink-0', statusColor(review.status))}>
                        {statusLabel(review.status)}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

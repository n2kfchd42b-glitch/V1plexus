"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  FolderOpen, FileText, ClipboardList, Bell,
  AlertCircle, Clock, ArrowRight, Plus, Activity
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelative, statusLabel } from '@/lib/utils'
import type { Project, ReviewRequest } from '@/types/database'

interface DashboardStats {
  projects: number
  documents: number
  pendingReviews: number
  unreadNotifications: number
}

function StatCard({
  label, value, icon: Icon, href, color, loading
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  href: string
  color: string
  loading?: boolean
}) {
  return (
    <Link href={href} className="group">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4 transition-all duration-150 hover:shadow-md hover:-translate-y-px card-hover">
        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-4 w-8" />
            <div className="skeleton h-7 w-12" />
            <div className="skeleton h-3.5 w-20" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', color.replace('text-', 'bg-').replace('600', '50').replace('red', 'red').replace('100', '50'))}>
                <Icon className={cn('h-4 w-4', color)} />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{value}</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5 font-medium">{label}</p>
          </>
        )}
      </div>
    </Link>
  )
}

function PhaseBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    draft:    'bg-[#F4F4F5] text-[#71717A]',
    active:   'bg-[#EFF6FF] text-[#2563EB]',
    completed:'bg-[#F0FDF4] text-[#16A34A]',
    archived: 'bg-[#FAFAFA] text-[#A1A1AA]',
  }
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium',
      colorMap[status] ?? 'bg-[#F4F4F5] text-[#71717A]'
    )}>
      {statusLabel(status)}
    </span>
  )
}

export default function DashboardPage() {
  const { profile, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({ projects: 0, documents: 0, pendingReviews: 0, unreadNotifications: 0 })
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [recentReviews, setRecentReviews] = useState<ReviewRequest[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (authLoading) return
    if (!profile) { setLoading(false); return }

    const fetchData = async () => {
      try {
        const [projectsRes, docsRes, reviewsRes, notifsRes, recentProjectsRes, recentReviewsRes] = await Promise.all([
          supabase.from('projects').select('id', { count: 'exact', head: true }),
          supabase.from('documents').select('id', { count: 'exact' }).eq('created_by', profile.id),
          supabase.from('review_requests').select('id', { count: 'exact' })
            .or(`requested_by.eq.${profile.id},assigned_to.eq.${profile.id}`)
            .in('status', ['pending', 'in_review']),
          supabase.from('notifications').select('id', { count: 'exact' })
            .eq('user_id', profile.id).eq('is_read', false),
          supabase.from('projects').select('*')
            .order('updated_at', { ascending: false }).limit(6),
          supabase.from('review_requests')
            .select(`*, document:documents(id, title), requester:profiles!requested_by(id, full_name)`)
            .or(`requested_by.eq.${profile.id},assigned_to.eq.${profile.id}`)
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
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [profile, authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Researcher'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const statCards = [
    { label: 'Projects',        value: stats.projects,             icon: FolderOpen,    href: '/projects',      color: 'text-blue-600' },
    { label: 'Documents',       value: stats.documents,            icon: FileText,      href: '/projects',      color: 'text-purple-600' },
    { label: 'Pending Reviews', value: stats.pendingReviews,       icon: ClipboardList, href: '/reviews',       color: 'text-amber-600' },
    { label: 'Notifications',   value: stats.unreadNotifications,  icon: Bell,          href: '/notifications', color: 'text-red-500' },
  ]

  return (
    <div className="px-6 py-5 max-w-6xl mx-auto space-y-6">
      {/* Welcome header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5 capitalize">
            {profile?.role} · PLEXUS Research Lab
          </p>
        </div>
        <Link href="/projects?new=1">
          <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[var(--accent-blue)] text-white text-sm font-medium hover:bg-blue-600 transition-colors duration-150 btn-press">
            <Plus className="h-3.5 w-3.5" />
            New Project
          </button>
        </Link>
      </div>

      {/* Action items bar */}
      {(stats.pendingReviews > 0 || stats.unreadNotifications > 0) && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--status-warning-bg)] border border-amber-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            {stats.pendingReviews > 0 && (
              <Link href="/reviews">
                <span className="text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors cursor-pointer bg-amber-100 px-2 py-0.5 rounded">
                  {stats.pendingReviews} pending review{stats.pendingReviews !== 1 ? 's' : ''}
                </span>
              </Link>
            )}
            {stats.unreadNotifications > 0 && (
              <Link href="/notifications">
                <span className="text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors cursor-pointer bg-blue-100 px-2 py-0.5 rounded">
                  {stats.unreadNotifications} unread notification{stats.unreadNotifications !== 1 ? 's' : ''}
                </span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(stat => (
          <StatCard key={stat.label} {...stat} loading={loading} />
        ))}
      </div>

      {/* Main content: projects + reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Projects */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent Projects</h2>
            <Link href="/projects" className="text-xs text-[var(--accent-blue)] hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1.5 flex-1">
                      <div className="skeleton h-4 w-48" />
                      <div className="skeleton h-3 w-24" />
                    </div>
                    <div className="skeleton h-5 w-16 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg py-12 text-center">
              <FolderOpen className="h-10 w-10 mx-auto text-[var(--text-tertiary)] mb-3" />
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">No projects yet</p>
              <p className="text-xs text-[var(--text-tertiary)] mb-4">Create a research project to get started</p>
              <Link href="/projects?new=1">
                <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[var(--accent-blue)] text-white text-sm font-medium hover:bg-blue-600 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                  Create Project
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentProjects.map(project => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="group bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-4 py-3 flex items-center justify-between gap-3 hover:border-[var(--border-strong)] hover:shadow-sm transition-all duration-150">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-md bg-[var(--accent-blue-subtle)] flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="h-4 w-4 text-[var(--accent-blue)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{project.title}</p>
                        <p className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {formatRelative(project.updated_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <PhaseBadge status={project.status} />
                      <ArrowRight className="h-3.5 w-3.5 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Review Queue */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Review Queue</h2>
            <Link href="/reviews" className="text-xs text-[var(--accent-blue)] hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3">
                  <div className="skeleton h-4 w-36 mb-1.5" />
                  <div className="skeleton h-3 w-20" />
                </div>
              ))}
            </div>
          ) : recentReviews.length === 0 ? (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg py-10 text-center">
              <div className="h-8 w-8 mx-auto mb-2 rounded-full bg-[var(--status-success-bg)] flex items-center justify-center">
                <Activity className="h-4 w-4 text-[var(--status-success-text)]" />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">All caught up</p>
              <p className="text-xs text-[var(--text-tertiary)]">No pending reviews</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentReviews.map(review => (
                <Link key={review.id} href={`/reviews?id=${review.id}`}>
                  <div className="group bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 hover:border-[var(--border-strong)] hover:shadow-sm transition-all duration-150">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {review.document?.title ?? 'Untitled'}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {formatRelative(review.created_at)}
                      </p>
                      <PhaseBadge status={review.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

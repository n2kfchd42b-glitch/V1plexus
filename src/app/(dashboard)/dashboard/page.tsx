"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  FolderOpen, FileText, ClipboardList, Bell,
  AlertCircle, Clock, ArrowRight, Plus, Activity
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
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
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-px">
        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-8 w-12" />
            <div className="skeleton h-3.5 w-24" />
          </div>
        ) : (
          <>
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">{label}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-extrabold font-headline tracking-tight">{value}</h3>
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', color.replace('text-', 'bg-').replace('600', '50').replace('red', 'red').replace('100', '50'))}>
                <Icon className={cn('h-4 w-4', color)} />
              </div>
            </div>
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
  const { activeWorkspace } = useWorkspace()
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
        const wsFilter = activeWorkspace ? { workspace_id: activeWorkspace.id } : null

        const [projectsRes, docsRes, reviewsRes, notifsRes, recentProjectsRes, recentReviewsRes] = await Promise.all([
          wsFilter
            ? supabase.from('projects').select('id', { count: 'exact', head: true }).eq('workspace_id', wsFilter.workspace_id).is('deleted_at', null)
            : supabase.from('projects').select('id', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('documents').select('id', { count: 'exact' }).eq('created_by', profile.id),
          supabase.from('review_requests').select('id', { count: 'exact' })
            .or(`requested_by.eq.${profile.id},assigned_to.eq.${profile.id}`)
            .in('status', ['pending', 'in_review']),
          supabase.from('notifications').select('id', { count: 'exact' })
            .eq('user_id', profile.id).eq('is_read', false),
          wsFilter
            ? supabase.from('projects').select('*').eq('workspace_id', wsFilter.workspace_id).is('deleted_at', null).order('updated_at', { ascending: false }).limit(6)
            : supabase.from('projects').select('*').is('deleted_at', null).order('updated_at', { ascending: false }).limit(6),
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
  }, [profile, authLoading, activeWorkspace]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="px-8 py-6 max-w-[1600px] mx-auto space-y-8">
      {/* Welcome header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-headline">
            {greeting}, {firstName}
          </h1>
          <p className="text-slate-500 mt-1 font-medium text-sm capitalize">
            {profile?.role} · PLEXUS Research Lab
          </p>
        </div>
        <Link href="/projects?new=1">
          <button className="inline-flex items-center gap-2 py-2.5 px-5 rounded-lg bg-[#0052CC] text-white text-sm font-headline font-bold hover:bg-[#0040a2] transition-all btn-press">
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </Link>
      </div>

      {/* Action items bar */}
      {(stats.pendingReviews > 0 || stats.unreadNotifications > 0) && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map(stat => (
          <StatCard key={stat.label} {...stat} loading={loading} />
        ))}
      </div>

      {/* Main content: projects + reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Projects */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold font-headline text-slate-900">Recent Projects</h2>
            <Link href="/projects" className="text-xs text-[#0052CC] hover:underline flex items-center gap-1 font-medium">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-3">
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
            <div className="bg-white border border-slate-200 rounded-xl py-12 text-center shadow-sm">
              <FolderOpen className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-900 mb-1">No projects yet</p>
              <p className="text-xs text-slate-400 mb-4">Create a research project to get started</p>
              <Link href="/projects?new=1">
                <button className="inline-flex items-center gap-2 py-2.5 px-4 rounded-lg bg-[#0052CC] text-white text-sm font-bold hover:bg-[#0040a2] transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                  Create Project
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentProjects.map(project => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="group bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 hover:border-slate-300 hover:shadow-sm transition-all duration-150">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="h-4 w-4 text-[#0052CC]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{project.title}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {formatRelative(project.updated_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <PhaseBadge status={project.status} />
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
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
            <h2 className="text-sm font-bold font-headline text-slate-900">Review Queue</h2>
            <Link href="/reviews" className="text-xs text-[#0052CC] hover:underline flex items-center gap-1 font-medium">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="skeleton h-4 w-36 mb-1.5" />
                  <div className="skeleton h-3 w-20" />
                </div>
              ))}
            </div>
          ) : recentReviews.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl py-10 text-center shadow-sm">
              <div className="h-8 w-8 mx-auto mb-2 rounded-full bg-emerald-50 flex items-center justify-center">
                <Activity className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-sm font-bold text-slate-900 mb-1">All caught up</p>
              <p className="text-xs text-slate-400">No pending reviews</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentReviews.map(review => (
                <Link key={review.id} href={`/reviews?id=${review.id}`}>
                  <div className="group bg-white border border-slate-200 rounded-xl px-3 py-2.5 hover:border-slate-300 hover:shadow-sm transition-all duration-150">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {review.document?.title ?? 'Untitled'}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-slate-400">
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

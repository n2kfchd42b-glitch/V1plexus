"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  FolderOpen, FileText, ClipboardList, Bell,
  AlertCircle, Clock, ArrowRight, Plus, Activity,
  CheckCircle2, Microscope, FlaskConical, Brain,
  BarChart2, Dna, BookOpen, Users, Beaker,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelative, statusLabel } from '@/lib/utils'
import type { Project, ReviewRequest, ProjectPhase } from '@/types/database'

interface DashboardStats {
  projects: number
  documents: number
  pendingReviews: number
  unreadNotifications: number
}

// Visual palettes for project cards — full Tailwind class strings (no dynamic concat)
const PALETTES = [
  { iconBg: 'bg-blue-50',   iconColor: 'text-blue-600',   bar: 'bg-blue-600',   tag: 'bg-blue-50 text-blue-700'   },
  { iconBg: 'bg-orange-50', iconColor: 'text-orange-600', bar: 'bg-orange-500', tag: 'bg-orange-50 text-orange-700' },
  { iconBg: 'bg-violet-50', iconColor: 'text-violet-600', bar: 'bg-violet-600', tag: 'bg-violet-50 text-violet-700' },
  { iconBg: 'bg-teal-50',   iconColor: 'text-teal-600',   bar: 'bg-teal-500',   tag: 'bg-teal-50 text-teal-700'   },
  { iconBg: 'bg-rose-50',   iconColor: 'text-rose-600',   bar: 'bg-rose-500',   tag: 'bg-rose-50 text-rose-700'   },
  { iconBg: 'bg-amber-50',  iconColor: 'text-amber-600',  bar: 'bg-amber-500',  tag: 'bg-amber-50 text-amber-700'  },
]

const PROJECT_ICONS = [Microscope, Brain, FlaskConical, BarChart2, Dna, BookOpen, Beaker, Activity]

const PHASE_PROGRESS: Record<ProjectPhase, number> = {
  design:          15,
  data_collection: 40,
  analysis:        65,
  writing:         80,
  submitted:       92,
  published:       100,
}

const PHASE_LABEL: Record<ProjectPhase, string> = {
  design:          'Design',
  data_collection: 'Data Collection',
  analysis:        'Analysis',
  writing:         'Writing',
  submitted:       'Submitted',
  published:       'Published',
}

const STATUS_TAG: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-500',
  active:    'bg-blue-50 text-blue-700',
  on_hold:   'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
  archived:  'bg-slate-100 text-slate-400',
}

const REVIEW_STATUS_COLOR: Record<string, string> = {
  pending:            'bg-amber-50 text-amber-700',
  in_review:          'bg-blue-50 text-blue-700',
  feedback_given:     'bg-violet-50 text-violet-700',
  revision_submitted: 'bg-teal-50 text-teal-700',
  approved:           'bg-emerald-50 text-emerald-700',
  rejected:           'bg-red-50 text-red-700',
}

function phaseProgress(project: Project): number {
  if (project.phase) return PHASE_PROGRESS[project.phase]
  if (project.status === 'completed') return 100
  if (project.status === 'draft')     return 8
  return 45
}

export default function DashboardPage() {
  const { profile, loading: authLoading } = useAuth()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const [stats, setStats] = useState<DashboardStats>({ projects: 0, documents: 0, pendingReviews: 0, unreadNotifications: 0 })
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [recentReviews, setRecentReviews] = useState<ReviewRequest[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    // Wait for BOTH auth and workspace to finish loading before fetching.
    // Without this, the effect fires twice: once with activeWorkspace=null
    // (auth ready) and again when the workspace resolves, causing 12 queries
    // and potential race conditions that leave skeletons stuck on screen.
    if (authLoading || wsLoading) return
    if (!profile) { setLoading(false); return }

    const fetchData = async () => {
      try {
        const wsId = activeWorkspace?.id

        // 10 s hard timeout — if any query hangs (slow RLS, network blip),
        // the finally block still runs and clears the loading state.
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Dashboard load timed out after 10 s')), 10_000)
        )

        const [projectsRes, docsRes, reviewsRes, notifsRes, recentProjectsRes, recentReviewsRes] =
          await Promise.race([
            Promise.all([
              // Project count — no workspace filter, RLS scopes to accessible projects
              supabase.from('projects').select('id', { count: 'exact', head: true }).is('deleted_at', null),
              // Document count — head:true avoids fetching row data
              supabase.from('documents').select('id', { count: 'exact', head: true }).eq('created_by', profile.id),
              supabase.from('review_requests').select('id', { count: 'exact', head: true })
                .or(`requested_by.eq.${profile.id},assigned_to.eq.${profile.id}`)
                .in('status', ['pending', 'in_review']),
              supabase.from('notifications').select('id', { count: 'exact', head: true })
                .eq('user_id', profile.id).eq('is_read', false),
              // Recent projects — workspace-scoped if available, otherwise all accessible
              wsId
                ? supabase.from('projects').select('*').eq('workspace_id', wsId).is('deleted_at', null).order('updated_at', { ascending: false }).limit(6)
                : supabase.from('projects').select('*').is('deleted_at', null).order('updated_at', { ascending: false }).limit(6),
              supabase.from('review_requests')
                .select('*, document:documents(id, title), requester:profiles!requested_by(id, full_name)')
                .or(`requested_by.eq.${profile.id},assigned_to.eq.${profile.id}`)
                .order('created_at', { ascending: false })
                .limit(5),
            ]),
            timeout,
          ])

        setStats({
          projects:            projectsRes.count ?? 0,
          documents:           docsRes.count ?? 0,
          pendingReviews:      reviewsRes.count ?? 0,
          unreadNotifications: notifsRes.count ?? 0,
        })
        if (recentProjectsRes.data) setRecentProjects(recentProjectsRes.data)
        if (recentReviewsRes.data) setRecentReviews(recentReviewsRes.data as ReviewRequest[])
      } catch (err) {
        // Log but don't crash — user sees zeros rather than stuck skeletons
        console.error('[Dashboard] fetchData error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [profile, authLoading, wsLoading, activeWorkspace]) // eslint-disable-line react-hooks/exhaustive-deps

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Researcher'
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="min-h-screen bg-[#f7f9fb]">

      {/* ── Hero Banner ─────────────────────────────────────── */}
      <div className="relative bg-slate-900 overflow-hidden">
        {/* Decorative rings */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 right-[20%] -translate-y-1/2 w-[700px] h-[700px] border border-blue-400/10 rounded-full" />
          <div className="absolute top-1/2 right-[20%] -translate-y-1/2 w-[480px] h-[480px] border border-blue-400/15 rounded-full" />
          <div className="absolute top-1/2 right-[20%] -translate-y-1/2 w-[260px] h-[260px] bg-blue-600/10 blur-3xl rounded-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900/50" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/40 to-transparent" />
        </div>

        <div className="relative z-10 px-8 pt-10 pb-12 max-w-[1600px] mx-auto">
          {/* Live indicator + greeting */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-blue-400 font-mono text-xs tracking-widest uppercase mb-3">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
              </span>
              Live Observatory Active
            </div>
            <h1 className="text-white font-headline text-5xl font-extrabold tracking-tighter mb-2">
              {greeting}, {firstName}
            </h1>
            <p className="text-blue-200/60 text-sm capitalize font-medium">
              {profile?.role?.replace(/_/g, ' ')} · {activeWorkspace?.name ?? 'PLEXUS Research Lab'}
            </p>
          </div>

          {/* Glass stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Projects',         value: stats.projects,            icon: FolderOpen,    href: '/projects',      sub: activeWorkspace?.name ?? 'All workspaces',  alert: false },
              { label: 'Documents',        value: stats.documents,           icon: FileText,      href: '/projects',      sub: 'Authored by you',                           alert: false },
              { label: 'Pending Reviews',  value: stats.pendingReviews,      icon: ClipboardList, href: '/reviews',       sub: 'Awaiting your attention',                   alert: stats.pendingReviews > 0 },
              { label: 'Notifications',    value: stats.unreadNotifications, icon: Bell,          href: '/notifications', sub: 'Unread messages',                           alert: stats.unreadNotifications > 0 },
            ].map(({ label, value, icon: Icon, href, sub, alert }) => (
              <Link key={label} href={href}>
                <div className={cn(
                  'bg-white/10 backdrop-blur-xl border border-white/15 rounded-xl p-5 hover:bg-white/15 transition-all cursor-pointer',
                  alert && !loading && 'border-amber-400/30 bg-amber-500/10 hover:bg-amber-500/15'
                )}>
                  <p className="text-blue-200/60 text-[10px] font-bold uppercase tracking-widest mb-1">{label}</p>
                  {loading ? (
                    <div className="h-10 w-14 bg-white/10 rounded animate-pulse mb-3" />
                  ) : (
                    <p className="text-white font-headline text-4xl font-extrabold leading-none mb-3">{value}</p>
                  )}
                  <div className="flex items-center gap-1.5 text-blue-300/70 text-xs font-semibold truncate">
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{sub}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────── */}
      <div className="px-8 pb-12 max-w-[1600px] mx-auto mt-8 space-y-8">

        {/* Action items alert */}
        {!loading && (stats.pendingReviews > 0 || stats.unreadNotifications > 0) && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-xl shadow-[0_4px_20px_rgba(245,158,11,0.08)]">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {stats.pendingReviews > 0 && (
                <Link href="/reviews">
                  <span className="text-xs font-semibold text-amber-800 hover:text-amber-900 bg-amber-100 px-2.5 py-1 rounded-full transition-colors cursor-pointer">
                    {stats.pendingReviews} pending review{stats.pendingReviews !== 1 ? 's' : ''}
                  </span>
                </Link>
              )}
              {stats.unreadNotifications > 0 && (
                <Link href="/notifications">
                  <span className="text-xs font-semibold text-blue-800 hover:text-blue-900 bg-blue-100 px-2.5 py-1 rounded-full transition-colors cursor-pointer">
                    {stats.unreadNotifications} unread notification{stats.unreadNotifications !== 1 ? 's' : ''}
                  </span>
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-8">

          {/* ── Current Research Projects ─────────────────── */}
          <section className="col-span-12 lg:col-span-8">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h3 className="font-headline text-2xl font-extrabold text-slate-900">Current Research Projects</h3>
                <p className="text-slate-400 text-sm mt-1">Active protocols and recent activity</p>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/projects?new=1">
                  <button className="inline-flex items-center gap-2 py-2 px-4 rounded-lg bg-gradient-to-r from-[#003d9b] to-[#0052cc] text-white text-sm font-headline font-bold hover:opacity-90 transition-all shadow-[0_4px_20px_rgba(0,82,204,0.22)] active:scale-95">
                    <Plus className="h-3.5 w-3.5" />
                    New Project
                  </button>
                </Link>
                <Link href="/projects" className="text-[#0052CC] font-bold text-sm flex items-center gap-1 hover:underline">
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Loading skeletons */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl p-6 shadow-[0_4px_30px_rgba(0,24,72,0.04)]">
                    <div className="flex justify-between mb-5">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl animate-pulse" />
                      <div className="w-20 h-5 bg-slate-100 rounded-full animate-pulse" />
                    </div>
                    <div className="space-y-2 mb-5">
                      <div className="h-5 w-3/4 bg-slate-100 rounded animate-pulse" />
                      <div className="h-3.5 w-full bg-slate-50 rounded animate-pulse" />
                      <div className="h-3.5 w-2/3 bg-slate-50 rounded animate-pulse" />
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full animate-pulse mb-2" />
                    <div className="h-3 w-24 bg-slate-50 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && recentProjects.length === 0 && (
              <div className="bg-white rounded-2xl py-16 text-center shadow-[0_4px_30px_rgba(0,24,72,0.04)]">
                <div className="w-14 h-14 mx-auto mb-4 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <FolderOpen className="h-7 w-7 text-[#0052CC]" />
                </div>
                <p className="text-base font-bold text-slate-900 mb-1">No projects yet</p>
                <p className="text-sm text-slate-400 mb-6">Create your first research project to get started</p>
                <Link href="/projects?new=1">
                  <button className="inline-flex items-center gap-2 py-2.5 px-5 rounded-lg bg-gradient-to-r from-[#003d9b] to-[#0052cc] text-white text-sm font-headline font-bold hover:opacity-90 transition-all shadow-[0_4px_20px_rgba(0,82,204,0.22)]">
                    <Plus className="h-4 w-4" />
                    Create Project
                  </button>
                </Link>
              </div>
            )}

            {/* Project cards grid */}
            {!loading && recentProjects.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {recentProjects.map((project, i) => {
                  const palette   = PALETTES[i % PALETTES.length]
                  const Icon      = PROJECT_ICONS[i % PROJECT_ICONS.length]
                  const progress  = phaseProgress(project)
                  const phaseLabel = project.phase ? PHASE_LABEL[project.phase] : null

                  return (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <div className="group bg-white rounded-2xl p-6 shadow-[0_4px_30px_rgba(0,24,72,0.04)] hover:shadow-[0_16px_50px_rgba(0,24,72,0.10)] transition-all duration-300 hover:-translate-y-0.5 cursor-pointer border border-transparent hover:border-blue-100">

                        {/* Card header */}
                        <div className="flex justify-between items-start mb-5">
                          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', palette.iconBg)}>
                            <Icon className={cn('h-5 w-5', palette.iconColor)} />
                          </div>
                          <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex-shrink-0', STATUS_TAG[project.status] ?? 'bg-slate-100 text-slate-500')}>
                            {statusLabel(project.status)}
                          </span>
                        </div>

                        {/* Title + description */}
                        <h4 className="font-headline font-bold text-base text-slate-900 mb-1.5 truncate">{project.title}</h4>
                        {project.description ? (
                          <p className="text-slate-400 text-xs leading-relaxed mb-5 line-clamp-2">{project.description}</p>
                        ) : (
                          <p className="text-slate-300 text-xs italic mb-5">No description added</p>
                        )}

                        {/* Phase progress bar */}
                        <div className="space-y-1.5">
                          {phaseLabel && (
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                              <span>Phase: {phaseLabel}</span>
                              <span>{progress}%</span>
                            </div>
                          )}
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', palette.bar)}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelative(project.updated_at)}
                            </p>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Right Panel ───────────────────────────────── */}
          <section className="col-span-12 lg:col-span-4">
            <div className="bg-white rounded-2xl p-7 shadow-[0_4px_30px_rgba(0,24,72,0.04)] h-full">

              {/* Review Queue */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline text-xl font-extrabold text-slate-900">Review Queue</h3>
                <Link href="/reviews" className="text-[#0052CC] font-bold text-xs flex items-center gap-1 hover:underline">
                  View All <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {loading && (
                <div className="space-y-2.5">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-slate-50">
                      <div className="h-4 w-36 bg-slate-200 rounded animate-pulse mb-1.5" />
                      <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              )}

              {!loading && recentReviews.length === 0 && (
                <div className="py-10 text-center">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 mb-1">All caught up</p>
                  <p className="text-xs text-slate-400">No pending reviews</p>
                </div>
              )}

              {!loading && recentReviews.length > 0 && (
                <div className="space-y-2">
                  {recentReviews.map(review => (
                    <Link key={review.id} href={`/reviews?id=${review.id}`}>
                      <div className="group flex items-start justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate mb-0.5">
                            {review.document?.title ?? 'Untitled Document'}
                          </p>
                          <p className="text-xs text-slate-400">{formatRelative(review.created_at)}</p>
                        </div>
                        <span className={cn('ml-2 flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full', REVIEW_STATUS_COLOR[review.status] ?? 'bg-slate-100 text-slate-500')}>
                          {statusLabel(review.status)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Quick Access */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Quick Access</p>
                <div className="space-y-1.5">
                  {[
                    { href: '/projects?new=1', icon: Plus,      iconBg: 'bg-blue-50',   iconColor: 'text-[#0052CC]', label: 'New Project',   sub: 'Start a research protocol'   },
                    { href: '/projects',       icon: BarChart2,  iconBg: 'bg-violet-50', iconColor: 'text-violet-600', label: 'Run Analysis',  sub: 'Statistical & AI insights'   },
                    { href: '/reviews',        icon: Users,      iconBg: 'bg-amber-50',  iconColor: 'text-amber-600',  label: 'Peer Reviews',  sub: 'Collaborate with your team'  },
                  ].map(({ href, icon: Icon, iconBg, iconColor, label, sub }) => (
                    <Link key={href} href={href}>
                      <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all group cursor-pointer">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', iconBg)}>
                          <Icon className={cn('h-4 w-4', iconColor)} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700 group-hover:text-[#0052CC] transition-colors leading-none mb-0.5">{label}</p>
                          <p className="text-[10px] text-slate-400">{sub}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

            </div>
          </section>
        </div>

        {/* ── Bottom Banner ───────────────────────────────── */}
        <section>
          <div className="bg-gradient-to-br from-[#001848] to-slate-900 rounded-2xl p-10 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">

            {/* Decorative rings */}
            <div className="absolute right-0 top-0 w-1/2 h-full pointer-events-none overflow-hidden">
              <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/4 w-80 h-80 border border-blue-400/15 rounded-full" />
              <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/4 w-52 h-52 border border-blue-400/20 rounded-full" />
              <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/4 w-28 h-28 bg-blue-600/20 blur-2xl rounded-full" />
            </div>

            <div className="max-w-lg z-10">
              <h2 className="text-white font-headline text-3xl font-extrabold mb-3">Empirical Precision Engine</h2>
              <p className="text-blue-200/60 text-sm leading-relaxed mb-7">
                PLEXUS runs multi-layer validation across your workspace, ensuring data integrity and research reproducibility at every step of the pipeline.
              </p>
              <div className="flex gap-8 items-start">
                <div>
                  <p className="text-white font-bold text-2xl leading-none">{loading ? '—' : stats.projects}</p>
                  <p className="text-blue-400 text-[10px] uppercase font-bold tracking-widest mt-1">Projects</p>
                </div>
                <div className="w-px h-8 bg-white/10 self-center" />
                <div>
                  <p className="text-white font-bold text-2xl leading-none">{loading ? '—' : stats.documents}</p>
                  <p className="text-blue-400 text-[10px] uppercase font-bold tracking-widest mt-1">Documents</p>
                </div>
                <div className="w-px h-8 bg-white/10 self-center" />
                <div>
                  <p className="text-white font-bold text-2xl leading-none">{loading ? '—' : stats.pendingReviews}</p>
                  <p className="text-blue-400 text-[10px] uppercase font-bold tracking-widest mt-1">In Review</p>
                </div>
              </div>
            </div>

            {/* Decorative mini chart card */}
            <div className="relative z-10 hidden md:block flex-shrink-0">
              <div className="bg-white rounded-xl p-4 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                <div className="flex gap-1 mb-2.5">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div className="w-44 h-28 bg-slate-50 rounded border border-slate-100 p-2.5">
                  <div className="space-y-1.5 mb-3">
                    <div className="h-1 w-full bg-blue-100 rounded-full" />
                    <div className="h-1 w-2/3 bg-blue-100 rounded-full" />
                    <div className="h-1 w-1/2 bg-blue-100 rounded-full" />
                  </div>
                  <div className="flex items-end gap-1.5 justify-end">
                    <div className="w-3 h-5  bg-[#003d9b] rounded-t-sm opacity-40" />
                    <div className="w-3 h-8  bg-[#003d9b] rounded-t-sm opacity-60" />
                    <div className="w-3 h-6  bg-[#003d9b] rounded-t-sm opacity-70" />
                    <div className="w-3 h-10 bg-[#003d9b] rounded-t-sm opacity-90" />
                    <div className="w-3 h-7  bg-[#0052cc] rounded-t-sm" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  )
}

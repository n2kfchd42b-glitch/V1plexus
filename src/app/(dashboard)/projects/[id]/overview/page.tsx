import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Database, BarChart2, Clock, FileText, Settings, TrendingUp,
  ArrowRight, Target,
} from "lucide-react";
import { ProjectGantt, type GanttPhase, type GanttNote } from "@/components/project/ProjectGantt";

// ── Phase config ─────────────────────────────────────────────────────────────
const GANTT_PHASES = [
  { key: 'concept',         label: 'Concept',         color: 'var(--phase-concept)' },
  { key: 'protocol',        label: 'Protocol',        color: 'var(--phase-protocol)' },
  { key: 'ethics',          label: 'Ethics Review',   color: 'var(--phase-ethics)' },
  { key: 'data_collection', label: 'Data Collection', color: 'var(--phase-data)' },
  { key: 'analysis',        label: 'Analysis',        color: 'var(--phase-analysis)' },
  { key: 'writing',         label: 'Writing',         color: 'var(--phase-writing)' },
  { key: 'publication',     label: 'Publication',     color: 'var(--phase-publication)' },
] as const

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Middleware already verified auth — getSession() reads the cookie locally,
  // no extra Supabase network round-trip needed just to get the user ID.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // ── Parallel data fetch ──────────────────────────────────────────────────
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    projectResult,
    { count: datasetCount },
    { count: runCount },
    { count: auditCount },
    { data: rawPhases },
    { data: rawNotes },
    { data: rawActivity },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("datasets").select("id", { count: "exact", head: true }).eq("project_id", id).is("deleted_at", null),
    supabase.from("analysis_runs").select("id", { count: "exact", head: true }).eq("project_id", id).eq("status", "completed"),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("project_id", id),
    supabase.from("project_phases").select("phase_key, start_date, end_date, completed_at").eq("project_id", id).order("created_at").then(r => ({ data: r.data ?? [] })),
    supabase.from("audit_logs").select("id, timestamp, details, actor:profiles(full_name)").eq("project_id", id).eq("action", "progress.note").order("timestamp", { ascending: false }).limit(20).then(r => ({ data: r.data ?? [] })),
    supabase.from("audit_logs").select("timestamp").eq("project_id", id).gte("timestamp", sevenDaysAgo.toISOString()).then(r => ({ data: r.data ?? [] })),
  ]);

  const project = projectResult.data;
  if (!project) notFound();

  // ── Shape data ───────────────────────────────────────────────────────────
  const phases = (rawPhases ?? []) as GanttPhase[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notes = (rawNotes ?? []).map((n: any) => ({
    id:        n.id,
    timestamp: n.timestamp,
    details:   n.details ?? {},
    actor:     n.actor   ?? null,
  })) as GanttNote[];

  // 7-day activity bars
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const activityDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    return { date: d, label: DAY_LABELS[d.getDay()], count: 0, isToday: i === 6 };
  });
  (rawActivity ?? []).forEach((entry: { timestamp: string }) => {
    const ed  = new Date(entry.timestamp);
    const idx = activityDays.findIndex(d =>
      d.date.getDate()     === ed.getDate()  &&
      d.date.getMonth()    === ed.getMonth() &&
      d.date.getFullYear() === ed.getFullYear()
    );
    if (idx >= 0) activityDays[idx].count++;
  });
  const maxActivity    = Math.max(...activityDays.map(d => d.count), 1);
  const completedCount = phases.filter(p => p.completed_at).length;

  const nextMilestone = GANTT_PHASES.map(cfg =>
    ({ cfg, phase: phases.find(p => p.phase_key === cfg.key) })
  ).find(({ phase }) => !phase?.completed_at)?.cfg ?? null;

  const statusColor: Record<string, string> = {
    draft:     'var(--timeline-neutral)',
    active:    'var(--accent-blue)',
    completed: 'var(--timeline-verified)',
    archived:  'var(--border-strong)',
    on_hold:   'var(--timeline-warning)',
  };

  const statusBadge: Record<string, { bg: string; text: string; border: string; label: string }> = {
    draft:     { bg: 'var(--bg-surface-active)',    text: 'var(--text-secondary)',        border: 'var(--border-default)',        label: 'Draft' },
    active:    { bg: 'var(--accent-blue-subtle)',   text: 'var(--accent-blue)',            border: 'var(--border-status-info)',    label: 'Active' },
    completed: { bg: 'var(--status-success-bg)',    text: 'var(--status-success-text)',    border: 'var(--border-status-success)', label: 'Completed' },
    on_hold:   { bg: 'var(--status-warning-bg)',    text: 'var(--status-warning-text)',    border: 'var(--border-status-warning)', label: 'On Hold' },
    archived:  { bg: 'var(--bg-surface-active)',    text: 'var(--text-tertiary)',          border: 'var(--border-default)',        label: 'Archived' },
  };
  const badge = statusBadge[project.status] ?? statusBadge.draft;

  // Compact header cards
  const quickLinks = [
    { href: `/projects/${id}/data`,     label: 'Data',     icon: Database,  iconColor: 'var(--phase-data)',     count: datasetCount ?? 0 },
    { href: `/projects/${id}/analysis`, label: 'Analysis', icon: BarChart2, iconColor: 'var(--accent-blue)',    count: runCount     ?? 0 },
    { href: `/projects/${id}/timeline`, label: 'Timeline', icon: Clock,     iconColor: 'var(--status-warning)', count: auditCount   ?? 0 },
    { href: `/projects/${id}/report`,   label: 'Report',   icon: FileText,  iconColor: 'var(--phase-writing)',  count: null as number | null },
    { href: `/projects/${id}/settings`, label: 'Settings', icon: Settings,  iconColor: 'var(--text-tertiary)',  count: null as number | null },
  ];

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: '100%', background: 'var(--bg-app)' }}
    >

      {/* ── Header: title, then status + nav row below ───────────────────────── */}
      <div
        className="flex-shrink-0 px-6 pt-6 pb-4"
        style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        {/* Title with left accent stripe */}
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 rounded-full"
            style={{ width: 4, height: 32, background: 'var(--accent-blue)' }}
          />
          <h1
            className="tracking-tight leading-none"
            style={{
              color:      'var(--text-primary)',
              fontFamily: 'var(--font-manrope)',
              fontWeight:  800,
              fontSize:   '1.75rem',
            }}
          >
            {project.title}
          </h1>
        </div>
        {project.description && (
          <p
            className="text-sm mt-1.5 leading-relaxed"
            style={{ color: 'var(--text-secondary)', maxWidth: 560 }}
          >
            {project.description}
          </p>
        )}

        {/* Status badge + nav links — same row */}
        <div className="flex items-center gap-0 mt-3">
          {/* Status badge */}
          <span
            className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold flex-shrink-0"
            style={{
              background: badge.bg,
              color:      badge.text,
              border:     `1px solid ${badge.border}`,
            }}
          >
            {badge.label}
          </span>

          {/* Pipe divider */}
          <span
            className="flex-shrink-0 mx-2.5"
            style={{ width: 1, height: 12, background: 'var(--border-default)', display: 'inline-block' }}
          />

          {/* Quiet nav links */}
          {quickLinks.map((link, i) => {
            const Icon = link.icon
            return (
              <span key={link.href} className="flex items-center">
                {i > 0 && (
                  <span
                    className="flex-shrink-0 mx-1.5"
                    style={{ width: 1, height: 12, background: 'var(--border-default)', display: 'inline-block' }}
                  />
                )}
                <Link
                  href={link.href}
                  className="flex items-center gap-1.5 px-1.5 py-1 rounded-md transition-all duration-150 opacity-50 hover:opacity-100 hover:bg-[var(--bg-surface-hover)]"
                >
                  <Icon className="h-3 w-3 flex-shrink-0" style={{ color: link.iconColor }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {link.label}
                  </span>
                  {link.count !== null && (
                    <span className="data-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      {link.count}
                    </span>
                  )}
                </Link>
              </span>
            )
          })}
        </div>
      </div>

      {/* ── Section label: Timeline ───────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between mx-5 mt-5 mb-2">
        <span
          className="text-[10px] font-semibold uppercase"
          style={{ color: 'var(--text-tertiary)', letterSpacing: '0.07em' }}
        >
          Research Timeline
        </span>
      </div>

      {/* ── Full-width Gantt ───────────────────────────────────────────────── */}
      <div className="flex-shrink-0 mx-5 mb-3 mt-0" style={{ height: 460 }}>
        {/*
          No overflow-hidden here — that was clipping the horizontal scrollbar.
          The Gantt component handles its own internal clipping.
          Border-radius is applied via outline ring trick below.
        */}
        <div
          className="rounded-lg h-full flex flex-col"
          style={{
            border:     '1px solid var(--border-default)',
            background: 'var(--bg-surface)',
            boxShadow:  'var(--shadow-xs)',
            overflow:   'clip',   /* clips visuals (border-radius) without clipping scrollbar */
          }}
        >
          <ProjectGantt
            projectId={id}
            userId={session.user.id}
            initialPhases={phases}
            initialNotes={notes}
          />
        </div>
      </div>

      {/* ── Section label: At a Glance ────────────────────────────────────── */}
      <div className="flex-shrink-0 mx-5 mb-2 mt-1">
        <span
          className="text-[10px] font-semibold uppercase"
          style={{ color: 'var(--text-tertiary)', letterSpacing: '0.07em' }}
        >
          At a Glance
        </span>
      </div>

      {/* ── Bento metrics ─────────────────────────────────────────────────── */}
      <div className="flex gap-3 mx-5 mb-5 flex-shrink-0">

        {/* Activity bar chart */}
        <div
          className="flex-1 min-w-0 rounded-lg p-5"
          style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-xs)' }}
        >
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-manrope)' }}>
                Activity This Week
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                Audit events per day
              </p>
            </div>
            <TrendingUp className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <div className="flex items-end gap-2 mt-5" style={{ height: 80 }}>
            {activityDays.map((day, i) => {
              const barH = day.count === 0
                ? 6
                : Math.max(10, Math.round((day.count / maxActivity) * 56));
              return (
                <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                  <span
                    className="data-mono text-[9px]"
                    style={{ color: day.count > 0 ? 'var(--text-secondary)' : 'transparent' }}
                  >
                    {day.count || ''}
                  </span>
                  <div
                    className="w-full rounded-sm transition-all duration-300"
                    style={{
                      height:     barH,
                      background: day.count === 0
                        ? 'var(--bg-inset)'
                        : day.isToday
                        ? 'var(--accent-blue)'
                        : 'color-mix(in srgb, var(--accent-blue) 55%, transparent)',
                    }}
                  />
                  <span
                    className="data-mono text-[9px] font-semibold"
                    style={{ color: day.isToday ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}
                  >
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Phase completion */}
        <div
          className="flex-shrink-0 rounded-lg p-4"
          style={{ width: 200, border: '1px solid var(--border-default)', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-xs)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.07em' }}>
              Phases
            </p>
            <span className="data-mono text-[10px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
              {completedCount} / 7
            </span>
          </div>
          <div className="flex items-end gap-1 mb-3">
            <span className="data-mono font-bold leading-none" style={{ fontSize: 32, color: 'var(--text-primary)' }}>
              {Math.round((completedCount / 7) * 100)}
            </span>
            <span className="data-mono text-xl font-semibold mb-0.5" style={{ color: 'var(--text-tertiary)' }}>%</span>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: 'var(--bg-inset)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width:      `${(completedCount / 7) * 100}%`,
                background: completedCount === 7 ? 'var(--status-success)' : 'var(--accent-blue)',
              }}
            />
          </div>
          <p className="text-[10px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
            {completedCount === 7
              ? 'All phases complete'
              : `${7 - completedCount} phase${7 - completedCount !== 1 ? 's' : ''} remaining`}
          </p>
        </div>

        {/* Next phase — dark */}
        <div
          className="flex-shrink-0 rounded-lg p-4 relative overflow-hidden flex flex-col"
          style={{ width: 200, background: 'var(--accent-primary)', boxShadow: 'var(--shadow-sm)' }}
        >
          <p className="text-[10px] font-semibold uppercase mb-2 flex-shrink-0" style={{ color: 'var(--text-inverse)', opacity: 0.5, letterSpacing: '0.07em' }}>
            Next Phase
          </p>

          {nextMilestone ? (
            <>
              <div className="mb-1">
                <p className="font-bold text-sm leading-snug tracking-tight" style={{ color: 'var(--text-inverse)', fontFamily: 'var(--font-manrope)' }}>
                  {nextMilestone.label}
                </p>
              </div>
              <p className="text-[10px]" style={{ color: 'var(--text-inverse)', opacity: 0.55 }}>
                {phases.find(p => p.phase_key === nextMilestone.key)?.start_date
                  ? `Starts ${phases.find(p => p.phase_key === nextMilestone.key)!.start_date}`
                  : 'No start date set'}
              </p>
            </>
          ) : (
            <p className="font-bold text-sm" style={{ color: 'var(--text-inverse)', fontFamily: 'var(--font-manrope)' }}>
              All phases complete!
            </p>
          )}

          <div className="mt-auto pt-3">
            <Link
              href={`/projects/${id}/timeline`}
              className="flex items-center gap-1 text-[10px] font-semibold transition-opacity duration-150 hover:opacity-80"
              style={{ color: 'var(--text-inverse)', opacity: 0.7 }}
            >
              View Timeline
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <Target
            className="absolute pointer-events-none"
            style={{ width: 64, height: 64, right: -12, bottom: -12, color: 'rgba(255,255,255,0.06)' }}
          />
        </div>

      </div>
    </div>
  );
}


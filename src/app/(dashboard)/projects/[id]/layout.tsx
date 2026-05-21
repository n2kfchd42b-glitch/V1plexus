import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectTabBar } from "@/components/project/ProjectTabBar";
import { InteractivePhaseBar } from "@/components/project/InteractivePhaseBar";
import type { GanttPhase } from "@/components/project/ProjectGantt";


// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  draft:     { bg: 'var(--bg-surface-active)',  text: 'var(--text-secondary)',      border: 'var(--border-default)',        label: 'Draft'     },
  active:    { bg: 'var(--accent-blue-subtle)', text: 'var(--accent-blue)',         border: 'var(--border-status-info)',    label: 'Active'    },
  completed: { bg: 'var(--status-success-bg)',  text: 'var(--status-success-text)', border: 'var(--border-status-success)', label: 'Completed' },
  on_hold:   { bg: 'var(--status-warning-bg)',  text: 'var(--status-warning-text)', border: 'var(--border-status-warning)', label: 'On Hold'   },
  archived:  { bg: 'var(--bg-surface-active)',  text: 'var(--text-tertiary)',       border: 'var(--border-default)',        label: 'Archived'  },
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default async function ProjectWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: { user } }, projectResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("projects")
      .select("id, owner_id, title, status, created_at")
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
  ]);

  if (!user) redirect("/login");
  if (!projectResult.data) notFound();

  const project = projectResult.data;

  // Access control
  if (project.owner_id !== user.id) {
    const { data: member } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (member?.role === "viewer") redirect(`/supervisor/projects/${id}`);
    if (!member) notFound();
  }

  // Data for hero strip + tab bar
  const [
    { count: datasetCount },
    { count: runCount },
    { data: rawPhases },
  ] = await Promise.all([
    supabase.from("datasets").select("id", { count: "exact", head: true }).eq("project_id", id).is("deleted_at", null),
    supabase.from("analysis_runs").select("id", { count: "exact", head: true }).eq("project_id", id).eq("status", "completed"),
    supabase.from("project_phases").select("phase_key, start_date, end_date, completed_at").eq("project_id", id).then(r => ({ data: r.data ?? [] })),
  ]);

  const phases = (rawPhases ?? []) as GanttPhase[]
  const badge  = STATUS_BADGE[project.status] ?? STATUS_BADGE.draft

  return (
    <div className="flex flex-col" style={{ minHeight: '100%', background: 'var(--bg-app)' }}>

      {/* ── Hero strip ────────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-3 py-3 sm:px-6 sm:py-4"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)' }}
      >
        <div className="flex items-baseline gap-2.5 flex-wrap mb-2">
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize:   'clamp(16px, 4vw, 22px)',
              fontStyle:  'italic',
              fontWeight: 400,
              color:      'var(--text-primary)',
              lineHeight: 1.2,
            }}
          >
            {project.title}
          </h1>

          <span
            className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium flex-shrink-0"
            style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}
          >
            {badge.label}
          </span>
        </div>

        <InteractivePhaseBar
          projectId={id}
          userId={user.id}
          initialPhases={phases}
          height={6}
          className="w-full sm:max-w-xl"
        />
      </div>

      {/* ── Horizontal tab bar ────────────────────────────────────────────────── */}
      <ProjectTabBar
        id={id}
        datasetCount={datasetCount ?? 0}
        runCount={runCount ?? 0}
      />

      {/* ── Tab content ───────────────────────────────────────────────────────── */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

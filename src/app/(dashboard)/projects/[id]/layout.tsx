import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectScrollHeader } from "@/components/project/ProjectScrollHeader";
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
      .select("id, owner_id, title, status, project_type, created_at")
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
    supabase.from("project_phases").select("phase_key, name, color, start_date, end_date, completed_at, sort_order, disabled").eq("project_id", id).then(r => ({ data: r.data ?? [] })),
  ]);

  const phases    = (rawPhases ?? []) as GanttPhase[]
  const badge     = STATUS_BADGE[project.status] ?? STATUS_BADGE.draft
  // project_type is a plain string column — check it directly
  const isThesis  = 'project_type' in project && (project as Record<string, unknown>).project_type === 'thesis'

  return (
    <div className="flex flex-col" style={{ minHeight: '100%', background: 'var(--bg-app)' }}>

      {/* ── Collapsible project header + sticky tab bar ───────────────────────── */}
      <ProjectScrollHeader
        projectId={id}
        userId={user.id}
        title={project.title}
        badge={badge}
        phases={phases}
        datasetCount={datasetCount ?? 0}
        runCount={runCount ?? 0}
        isThesis={isThesis}
      />

      {/* ── Tab content ───────────────────────────────────────────────────────── */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

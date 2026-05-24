import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AI_ENABLED } from "@/lib/flags";
import { ProjectOverviewClient } from "@/components/project/ProjectOverviewClient";
import type { GanttPhase } from "@/components/project/ProjectGantt";
import type { ActivityLog, DbTask, SupervisorMilestone, RecentDoc, LatestRun } from "@/components/project/ProjectOverviewClient";

const PHASE_ORDER = [
  'concept', 'protocol', 'ethics', 'data_collection',
  'analysis', 'writing', 'publication',
] as const

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: supervisorAssignment } = await supabase
    .from("supervisor_assignments")
    .select("supervisor_id")
    .eq("student_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const hasSupervisor = !!supervisorAssignment;

  const [
    projectResult,
    { data: rawPhases },
    { data: rawActivityLogs },
    { data: rawSupervisorLogs },
    { data: rawTasks },
    { data: rawMilestones },
    { data: rawDocs },
    { data: rawLatestRun },
    { count: datasetCount },
    { count: runCount },
    { data: rawChapters },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("project_phases").select("phase_key, name, color, start_date, end_date, completed_at, sort_order, disabled").eq("project_id", id).order("sort_order").then(r => ({ data: r.data ?? [] })),
    supabase.from("audit_logs").select("id, timestamp, action, details, actor:profiles(full_name)").eq("project_id", id).order("timestamp", { ascending: false }).limit(8).then(r => ({ data: r.data ?? [] })),
    supabase.from("audit_logs").select("id, timestamp, action, details, actor:profiles(full_name)").eq("project_id", id).neq("actor_id", user.id).order("timestamp", { ascending: false }).limit(5).then(r => ({ data: r.data ?? [] })),
    supabase.from("project_tasks").select("id, text, due_date, done, created_at").eq("project_id", id).eq("user_id", user.id).order("created_at", { ascending: true }).then(r => ({ data: r.data ?? [] })),
    hasSupervisor
      ? supabase.from("student_milestones").select("id, title, due_date, status, phase").eq("project_id", id).eq("student_id", user.id).in("status", ["pending", "under_review", "revision_requested"]).order("due_date", { ascending: true, nullsFirst: false }).limit(5).then(r => ({ data: r.data ?? [] }))
      : Promise.resolve({ data: [] }),
    supabase.from("documents").select("id, title, doc_type, updated_at").eq("project_id", id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(4).then(r => ({ data: r.data ?? [] })),
    supabase.from("analysis_runs").select("id, title, analysis_type, status, interpretation, created_at").eq("project_id", id).eq("status", "completed").order("created_at", { ascending: false }).limit(1).then(r => ({ data: r.data ?? [] })),
    supabase.from("datasets").select("id", { count: "exact", head: true }).eq("project_id", id).is("deleted_at", null),
    supabase.from("analysis_runs").select("id", { count: "exact", head: true }).eq("project_id", id).eq("status", "completed"),
    supabase.from("thesis_chapters").select("status").eq("project_id", id).then(r => ({ data: r.data ?? [] })),
  ]);

  const project = projectResult.data;
  if (!project) notFound();

  const phases = (rawPhases ?? []) as GanttPhase[];
  const completedCount = phases.filter(p => p.completed_at).length;

  const nextMilestoneKey = PHASE_ORDER.find(
    key => !phases.find(p => p.phase_key === key)?.completed_at
  ) ?? null;

  const isThesis = (project as { project_type?: string }).project_type === "thesis";
  const chapters = (rawChapters ?? []) as { status: string }[];
  const chaptersTotal = chapters.length;
  const chaptersApproved = chapters.filter(c => c.status === "approved").length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapLog = (e: any): ActivityLog => ({
    id:        e.id,
    timestamp: e.timestamp,
    action:    e.action ?? '',
    details:   e.details ?? {},
    actor:     e.actor ?? null,
  })

  const activityLogs: ActivityLog[]   = (rawActivityLogs ?? []).map(mapLog)
  const supervisorLogs: ActivityLog[] = (rawSupervisorLogs ?? []).map(mapLog)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialTasks: DbTask[] = (rawTasks ?? []).map((t: any) => ({
    id:         t.id,
    text:       t.text,
    due_date:   t.due_date ?? null,
    done:       t.done,
    created_at: t.created_at,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supervisorMilestones: SupervisorMilestone[] = (rawMilestones ?? []).map((m: any) => ({
    id:       m.id,
    title:    m.title,
    due_date: m.due_date ?? null,
    status:   m.status,
    phase:    m.phase ?? null,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentDocs: RecentDoc[] = (rawDocs ?? []).map((d: any) => ({
    id:            d.id,
    title:         d.title,
    document_type: d.doc_type ?? 'general',
    updated_at:    d.updated_at,
  }))

  const rawRun = (rawLatestRun ?? [])[0] ?? null
  const latestRun: LatestRun | null = rawRun ? {
    id:             rawRun.id,
    title:          rawRun.title ?? null,
    analysis_type:  rawRun.analysis_type,
    status:         rawRun.status,
    interpretation: rawRun.interpretation ?? null,
    created_at:     rawRun.created_at,
  } : null

  return (
    <ProjectOverviewClient
      id={id}
      project={{
        title:       project.title,
        description: project.description ?? null,
        status:      project.status,
        created_at:  project.created_at,
      }}
      completedCount={completedCount}
      nextMilestoneKey={nextMilestoneKey}
      initialPhases={phases}
      activityLogs={activityLogs}
      supervisorLogs={supervisorLogs}
      hasSupervisor={hasSupervisor}
      initialTasks={initialTasks}
      supervisorMilestones={supervisorMilestones}
      recentDocs={recentDocs}
      latestRun={latestRun}
      aiEnabled={AI_ENABLED}
      isThesis={isThesis}
      datasetCount={datasetCount ?? 0}
      runCount={runCount ?? 0}
      chaptersTotal={chaptersTotal}
      chaptersApproved={chaptersApproved}
    />
  );
}

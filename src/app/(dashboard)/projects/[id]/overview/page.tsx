import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectOverviewClient } from "@/components/project/ProjectOverviewClient";
import type { GanttPhase } from "@/components/project/ProjectGantt";
import type { ActivityLog, DbTask, SupervisorMilestone } from "@/components/project/ProjectOverviewClient";

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

  // Check supervisor assignment first so we can conditionally fetch milestones
  const { data: supervisorAssignment } = await supabase
    .from("supervisor_assignments")
    .select("supervisor_id")
    .eq("student_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const hasSupervisor = !!supervisorAssignment;

  const [
    projectResult,
    { count: datasetCount },
    { count: runCount },
    { count: auditCount },
    { data: rawPhases },
    { data: rawActivityLogs },
    { data: rawSupervisorLogs },
    { data: rawTasks },
    { data: rawMilestones },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("datasets").select("id", { count: "exact", head: true }).eq("project_id", id).is("deleted_at", null),
    supabase.from("analysis_runs").select("id", { count: "exact", head: true }).eq("project_id", id).eq("status", "completed"),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).eq("project_id", id),
    supabase.from("project_phases").select("phase_key, start_date, end_date, completed_at").eq("project_id", id).order("created_at").then(r => ({ data: r.data ?? [] })),
    supabase.from("audit_logs").select("id, timestamp, action, details, actor:profiles(full_name)").eq("project_id", id).order("timestamp", { ascending: false }).limit(8).then(r => ({ data: r.data ?? [] })),
    supabase.from("audit_logs").select("id, timestamp, action, details, actor:profiles(full_name)").eq("project_id", id).neq("actor_id", user.id).order("timestamp", { ascending: false }).limit(5).then(r => ({ data: r.data ?? [] })),
    supabase.from("project_tasks").select("id, text, due_date, done, created_at").eq("project_id", id).eq("user_id", user.id).order("created_at", { ascending: true }).then(r => ({ data: r.data ?? [] })),
    hasSupervisor
      ? supabase.from("student_milestones").select("id, title, due_date, status, phase").eq("project_id", id).eq("student_id", user.id).in("status", ["pending", "under_review", "revision_requested"]).order("due_date", { ascending: true, nullsFirst: false }).limit(5).then(r => ({ data: r.data ?? [] }))
      : Promise.resolve({ data: [] }),
  ]);

  const project = projectResult.data;
  if (!project) notFound();

  const phases = (rawPhases ?? []) as GanttPhase[];
  const completedCount = phases.filter(p => p.completed_at).length;

  const nextMilestoneKey = PHASE_ORDER.find(
    key => !phases.find(p => p.phase_key === key)?.completed_at
  ) ?? null;

  const nextMilestoneStartDate = nextMilestoneKey
    ? (phases.find(p => p.phase_key === nextMilestoneKey)?.start_date ?? null)
    : null;

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
      nextMilestoneStartDate={nextMilestoneStartDate}
      datasetCount={datasetCount ?? 0}
      runCount={runCount ?? 0}
      auditCount={auditCount ?? 0}
      initialPhases={phases}
      activityLogs={activityLogs}
      supervisorLogs={supervisorLogs}
      userId={user.id}
      hasSupervisor={hasSupervisor}
      initialTasks={initialTasks}
      supervisorMilestones={supervisorMilestones}
    />
  );
}

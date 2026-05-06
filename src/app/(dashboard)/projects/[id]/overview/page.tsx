import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectOverviewClient } from "@/components/project/ProjectOverviewClient";
import type { GanttPhase, GanttNote } from "@/components/project/ProjectGantt";

// ── Phase key → next-milestone lookup ────────────────────────────────────────
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

  const phases = (rawPhases ?? []) as GanttPhase[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notes = (rawNotes ?? []).map((n: any) => ({
    id:        n.id,
    timestamp: n.timestamp,
    details:   n.details ?? {},
    actor:     n.actor   ?? null,
  })) as GanttNote[];

  // 7-day activity — pass dayIndex (0–6) instead of label strings
  const activityDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    return { dayIndex: d.getDay(), count: 0, isToday: i === 6 };
  });
  (rawActivity ?? []).forEach((entry: { timestamp: string }) => {
    const ed  = new Date(entry.timestamp);
    const idx = activityDays.findIndex((_, i) => {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      return d.getDate() === ed.getDate() && d.getMonth() === ed.getMonth() && d.getFullYear() === ed.getFullYear();
    });
    if (idx >= 0) activityDays[idx].count++;
  });

  const maxActivity    = Math.max(...activityDays.map(d => d.count), 1);
  const completedCount = phases.filter(p => p.completed_at).length;

  const nextMilestoneKey = PHASE_ORDER.find(
    key => !phases.find(p => p.phase_key === key)?.completed_at
  ) ?? null;

  const nextMilestoneStartDate = nextMilestoneKey
    ? (phases.find(p => p.phase_key === nextMilestoneKey)?.start_date ?? null)
    : null;

  return (
    <ProjectOverviewClient
      id={id}
      project={{ title: project.title, description: project.description ?? null, status: project.status }}
      activityDays={activityDays}
      maxActivity={maxActivity}
      completedCount={completedCount}
      nextMilestoneKey={nextMilestoneKey}
      nextMilestoneStartDate={nextMilestoneStartDate}
      datasetCount={datasetCount ?? 0}
      runCount={runCount ?? 0}
      auditCount={auditCount ?? 0}
      initialPhases={phases}
      initialNotes={notes}
      userId={user.id}
    />
  );
}

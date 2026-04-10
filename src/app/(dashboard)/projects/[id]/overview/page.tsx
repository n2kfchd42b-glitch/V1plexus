import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import { Database, BarChart2, Clock, FileText, Settings, ChevronRight } from "lucide-react";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const [
    { count: datasetCount },
    { count: runCount },
    { count: auditCount },
    { data: recentActivity },
  ] = await Promise.all([
    supabase
      .from("datasets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id)
      .is("deleted_at", null),
    supabase
      .from("analysis_runs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id)
      .eq("status", "completed"),
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id),
    supabase
      .from("audit_logs")
      .select("id, action, resource_type, timestamp, actor:profiles(full_name)")
      .eq("project_id", id)
      .order("timestamp", { ascending: false })
      .limit(5),
  ]);

  const statusColor: Record<string, string> = {
    draft:     "var(--timeline-neutral)",
    active:    "var(--accent-blue)",
    completed: "var(--timeline-verified)",
    archived:  "var(--border-strong)",
    on_hold:   "var(--timeline-warning)",
  };

  const tabs = [
    { href: `/projects/${id}/data`,     label: "Data",     icon: Database,  meta: `${datasetCount ?? 0} dataset${(datasetCount ?? 0) !== 1 ? "s" : ""}` },
    { href: `/projects/${id}/analysis`, label: "Analysis", icon: BarChart2, meta: `${runCount ?? 0} ${(runCount ?? 0) === 1 ? "run" : "runs"} completed` },
    { href: `/projects/${id}/timeline`, label: "Timeline", icon: Clock,     meta: `${auditCount ?? 0} ${(auditCount ?? 0) === 1 ? "entry" : "entries"}` },
    { href: `/projects/${id}/report`,   label: "Report",   icon: FileText,  meta: "Generate research record" },
    { href: `/projects/${id}/settings`, label: "Settings", icon: Settings,  meta: "Project configuration" },
  ];

  function describeAction(action: string, resourceType: string): string {
    const type = resourceType?.replace(/_/g, " ") ?? "";
    const act  = action?.replace(/_/g, " ") ?? "";
    if (action === "dataset.uploaded")         return "Dataset uploaded";
    if (action === "dataset.version_committed") return "Dataset version saved";
    if (action === "analysis.completed")        return "Analysis run completed";
    if (action === "analysis.created")          return "Analysis started";
    if (action.startsWith("dataset."))         return `Dataset ${act.replace("dataset.", "")}`;
    if (action.startsWith("analysis."))        return `Analysis ${act.replace("analysis.", "")}`;
    return `${type} ${act}`.trim();
  }

  return (
    <div className="page-shell">

      {/* Project header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-start gap-3">
          <span
            className="status-dot-md mt-1.5 flex-shrink-0"
            style={{ backgroundColor: statusColor[project.status] ?? statusColor.draft }}
          />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[var(--text-primary)] leading-snug tracking-tight">
              {project.title}
            </h1>
            {project.description && (
              <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed max-w-2xl">
                {project.description}
              </p>
            )}
            <p className="text-xs text-[var(--text-tertiary)] mt-2 capitalize">
              {project.status.replace(/_/g, " ")}
              {project.updated_at && (
                <> · Last active {formatRelative(project.updated_at)}</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[var(--border-row)] mx-6" />

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Section: Quick access */}
        <div className="pt-2">
          <p className="section-label">Workspace</p>
          {tabs.map(({ href, label, icon: Icon, meta }) => (
            <Link key={href} href={href} className="block">
              <div className="row-item group">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Icon className="h-4 w-4 text-[var(--text-tertiary)] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{meta}</p>
                  </div>
                </div>
                <ChevronRight className="row-action h-4 w-4 text-[var(--text-tertiary)] flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>

        {/* Section: Recent activity */}
        <div className="pt-2">
          <div className="flex items-center justify-between pr-4">
            <p className="section-label flex-1">Recent activity</p>
            <Link
              href={`/projects/${id}/timeline`}
              className="text-xs text-[var(--accent-blue)] hover:underline"
            >
              View timeline
            </Link>
          </div>

          {(!recentActivity || recentActivity.length === 0) ? (
            <div className="empty-state py-8">
              <p className="empty-state-title">No activity yet</p>
              <p className="empty-state-description">
                Upload a dataset or run an analysis to start building your record.
              </p>
            </div>
          ) : (
            recentActivity.map((entry) => {
              const actor = entry.actor as { full_name?: string } | null;
              return (
                <div key={entry.id} className="row-item-sm pointer-events-none">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="status-dot status-dot--verified flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-primary)] truncate">
                        {describeAction(entry.action, entry.resource_type)}
                      </p>
                      {actor?.full_name && (
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {actor.full_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="data-mono-xs text-[var(--text-tertiary)] flex-shrink-0">
                    {formatRelative(entry.timestamp)}
                  </span>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}

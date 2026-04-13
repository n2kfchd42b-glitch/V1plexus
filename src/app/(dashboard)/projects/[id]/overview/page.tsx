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

  // Workspace cards — 3+2 grid layout
  const workspaceCards = [
    {
      href:        `/projects/${id}/data`,
      label:       "Data",
      icon:        Database,
      count:       datasetCount ?? 0,
      descriptor:  "datasets",
      iconBg:      "var(--phase-data)",
      iconBgAlpha: 0.12,
    },
    {
      href:        `/projects/${id}/analysis`,
      label:       "Analysis",
      icon:        BarChart2,
      count:       runCount ?? 0,
      descriptor:  "completed runs",
      iconBg:      "var(--accent-blue)",
      iconBgAlpha: 0.12,
    },
    {
      href:        `/projects/${id}/timeline`,
      label:       "Timeline",
      icon:        Clock,
      count:       auditCount ?? 0,
      descriptor:  "audit entries",
      iconBg:      "var(--status-warning)",
      iconBgAlpha: 0.12,
    },
    {
      href:        `/projects/${id}/report`,
      label:       "Report",
      icon:        FileText,
      count:       null as number | null,
      descriptor:  "Generate record",
      iconBg:      "var(--phase-writing)",
      iconBgAlpha: 0.12,
    },
    {
      href:        `/projects/${id}/settings`,
      label:       "Settings",
      icon:        Settings,
      count:       null as number | null,
      descriptor:  "Configuration",
      iconBg:      "var(--text-tertiary)",
      iconBgAlpha: 0.10,
    },
  ];

  function describeAction(action: string, resourceType: string): string {
    const type = resourceType?.replace(/_/g, " ") ?? "";
    const act  = action?.replace(/_/g, " ") ?? "";
    if (action === "dataset.uploaded")          return "Dataset uploaded";
    if (action === "dataset.version_committed") return "Dataset version saved";
    if (action === "analysis.completed")        return "Analysis run completed";
    if (action === "analysis.created")          return "Analysis started";
    if (action.startsWith("dataset."))          return `Dataset ${act.replace("dataset.", "")}`;
    if (action.startsWith("analysis."))         return `Analysis ${act.replace("analysis.", "")}`;
    return `${type} ${act}`.trim();
  }

  return (
    <div className="page-shell">

      {/* ── Project header card ─────────────────────────────────────────── */}
      <div className="mx-6 mt-5 mb-0 rounded-lg overflow-hidden flex-shrink-0"
        style={{
          border:     '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          boxShadow:  'var(--shadow-xs)',
        }}>
        {/* 3px top accent bar */}
        <div className="h-[3px]" style={{ background: 'var(--accent-blue)' }} />

        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <span
              className="status-dot-md mt-[7px] flex-shrink-0"
              style={{ backgroundColor: statusColor[project.status] ?? statusColor.draft }}
            />
            <div className="min-w-0 flex-1">
              <h1
                className="text-xl font-bold leading-snug tracking-tight"
                style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}
              >
                {project.title}
              </h1>
              {project.description && (
                <p className="text-sm mt-1 leading-relaxed max-w-2xl"
                  style={{ color: 'var(--text-secondary)' }}>
                  {project.description}
                </p>
              )}
              <p className="data-mono-xs mt-2 capitalize" style={{ color: 'var(--text-tertiary)' }}>
                {project.status.replace(/_/g, " ")}
                {project.updated_at && (
                  <> · Last active {formatRelative(project.updated_at)}</>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Workspace — 3+2 card grid ────────────────────────────────── */}
        <div className="px-6 pt-5 pb-2">
          <p className="subsection-label mb-3">Workspace</p>

          {/* Row 1: 3 cards */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            {workspaceCards.slice(0, 3).map(card => (
              <WorkspaceCard key={card.href} card={card} />
            ))}
          </div>

          {/* Row 2: 2 cards */}
          <div className="grid grid-cols-2 gap-3">
            {workspaceCards.slice(3).map(card => (
              <WorkspaceCard key={card.href} card={card} />
            ))}
          </div>
        </div>

        {/* ── Recent activity ─────────────────────────────────────────── */}
        <div className="pt-3">
          <div className="flex items-center justify-between pr-4">
            <p className="section-label flex-1">Recent activity</p>
            <Link
              href={`/projects/${id}/timeline`}
              className="text-xs hover:underline"
              style={{ color: 'var(--accent-blue)' }}
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
            recentActivity.map((entry, i) => {
              const actor = entry.actor as { full_name?: string } | null;
              return (
                <div
                  key={entry.id}
                  className="row-item-sm pointer-events-none animate-fade-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="status-dot status-dot--verified flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                        {describeAction(entry.action, entry.resource_type)}
                      </p>
                      {actor?.full_name && (
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {actor.full_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="data-mono-xs flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
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

// ── Workspace card ─────────────────────────────────────────────────────────

function WorkspaceCard({ card }: {
  card: {
    href: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    count: number | null
    descriptor: string
    iconBg: string
    iconBgAlpha: number
  }
}) {
  const Icon = card.icon
  return (
    <Link href={card.href}>
      <div
        className="card-hover rounded-lg p-4 flex flex-col gap-3 cursor-pointer"
        style={{
          border:     '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          boxShadow:  'var(--shadow-xs)',
        }}
      >
        {/* Icon container */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${card.iconBg} 15%, transparent)` }}
        >
          <span style={{ color: card.iconBg }}><Icon className="h-4 w-4" /></span>
        </div>

        {/* Label + count */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-none mb-1" style={{ color: 'var(--text-primary)' }}>
            {card.label}
          </p>
          {card.count !== null ? (
            <p
              className="text-2xl font-bold leading-none"
              style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}
            >
              {card.count}
            </p>
          ) : null}
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {card.descriptor}
          </p>
        </div>

        {/* Arrow */}
        <ChevronRight className="h-3.5 w-3.5 self-end" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    </Link>
  )
}

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { FileText, ShieldCheck, Calendar, ClipboardList, GitMerge, CheckCircle, Clock } from "lucide-react";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const [
    { count: docCount },
    { count: ethicsCount },
    { count: pendingReviewCount },
    { data: gates },
  ] = await Promise.all([
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id)
      .is("deleted_at", null),
    supabase
      .from("ethics_applications")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id),
    supabase
      .from("review_requests")
      .select("id", { count: "exact", head: true })
      .eq("documents.project_id", id)
      .in("status", ["pending", "in_review"]),
    supabase
      .from("approval_gates")
      .select("id, title, status, gate_type")
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const approvedGates = gates?.filter(g => g.status === "approved").length ?? 0;
  const totalGates = gates?.length ?? 0;

  const statCards = [
    {
      href: `/projects/${id}/documents`,
      label: "Documents",
      count: docCount ?? 0,
      icon: FileText,
      color: "blue" as const,
    },
    {
      href: `/projects/${id}/ethics`,
      label: "Ethics Applications",
      count: ethicsCount ?? 0,
      icon: ShieldCheck,
      color: "green" as const,
    },
    {
      href: `/reviews`,
      label: "Pending Reviews",
      count: pendingReviewCount ?? 0,
      icon: ClipboardList,
      color: "orange" as const,
    },
    {
      href: `/projects/${id}/approvals`,
      label: "Approval Gates",
      count: totalGates,
      icon: GitMerge,
      color: "purple" as const,
      sub: totalGates > 0 ? `${approvedGates}/${totalGates} approved` : undefined,
    },
  ];

  const colorMap = {
    blue:   { bg: "bg-blue-50 dark:bg-blue-950/30",   icon: "text-blue-600",   hover: "hover:border-blue-200 dark:hover:border-blue-800" },
    green:  { bg: "bg-green-50 dark:bg-green-950/30", icon: "text-green-600",  hover: "hover:border-green-200 dark:hover:border-green-800" },
    orange: { bg: "bg-orange-50 dark:bg-orange-950/30", icon: "text-orange-600", hover: "hover:border-orange-200 dark:hover:border-orange-800" },
    purple: { bg: "bg-purple-50 dark:bg-purple-950/30", icon: "text-purple-600", hover: "hover:border-purple-200 dark:hover:border-purple-800" },
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">{project.title}</h2>
        {(project.start_date || project.end_date) && (
          <div className="flex items-center gap-5 mt-2 text-sm text-[var(--text-tertiary)]">
            {project.start_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Start: {formatDate(project.start_date)}
              </span>
            )}
            {project.end_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                End: {formatDate(project.end_date)}
              </span>
            )}
          </div>
        )}
      </div>

      {project.description && (
        <p className="text-sm text-[var(--text-secondary)] mb-7 leading-relaxed">{project.description}</p>
      )}

      {/* Quick stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {statCards.map(({ href, label, count, icon: Icon, color, sub }) => {
          const c = colorMap[color];
          return (
            <Link
              key={href}
              href={href}
              className={`bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5 ${c.hover} hover:shadow-sm transition-all duration-150`}
            >
              <div className="flex items-center gap-3">
                <div className={`${c.bg} rounded-lg p-2`}>
                  <Icon className={`h-5 w-5 ${c.icon}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{count}</p>
                  <p className="text-sm text-[var(--text-tertiary)]">{label}</p>
                  {sub && <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{sub}</p>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Approval Gates summary */}
      {totalGates > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <GitMerge className="h-4 w-4 text-[var(--text-tertiary)]" />
            Approval Gates
          </h3>
          <div className="space-y-2">
            {gates!.map(gate => (
              <Link
                key={gate.id}
                href={`/projects/${id}/approvals`}
                className="flex items-center gap-3 p-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg hover:border-[var(--border-strong)] transition-colors duration-150"
              >
                {gate.status === "approved" ? (
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                ) : gate.status === "blocked" ? (
                  <Clock className="h-4 w-4 text-red-500 flex-shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-[var(--text-tertiary)] flex-shrink-0" />
                )}
                <span className="text-sm text-[var(--text-primary)] flex-1 truncate">{gate.title}</span>
                <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${
                  gate.status === "approved"
                    ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                    : gate.status === "blocked"
                    ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                    : "bg-[var(--bg-inset)] text-[var(--text-tertiary)]"
                }`}>
                  {gate.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-xs text-[var(--text-tertiary)]">
        Project created {formatDate(project.created_at)}
      </p>
    </div>
  );
}

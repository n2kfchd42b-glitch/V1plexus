import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Calendar, ArrowRight } from "lucide-react";
import { LatestAnalysisCards } from "@/components/analysis/LatestAnalysisCards";

const modules = (id: string) => [
  {
    href: `/projects/${id}/data`,
    title: "Dataset Hub",
    materialIcon: "cloud_download",
    subKey: "datasets",
  },
  {
    href: `/projects/${id}/team`,
    title: "Team Management",
    materialIcon: "groups",
    subKey: "members",
  },
  {
    href: `/projects/${id}/documents`,
    title: "Document Editor",
    materialIcon: "edit_note",
    subKey: "documents",
  },
  {
    href: `/projects/${id}/analysis`,
    title: "Analysis Engine",
    materialIcon: "bolt",
    subKey: "analysis",
  },
  {
    href: `/projects/${id}/field`,
    title: "Field Operations",
    materialIcon: "location_on",
    subKey: "field",
  },
  {
    href: `/projects/${id}/settings`,
    title: "System Settings",
    materialIcon: "tune",
    subKey: "settings",
  },
  {
    href: `/projects/${id}/ethics`,
    title: "Integrity & Ethics",
    materialIcon: "verified_user",
    subKey: "ethics",
  },
  {
    href: `/projects/${id}/approvals`,
    title: "Compliance Approval",
    materialIcon: "approval_delegation",
    subKey: "approvals",
  },
];

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
    { count: datasetCount },
    { count: memberCount },
    { data: gates },
    { data: latestRuns },
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
      .from("datasets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id)
      .is("deleted_at", null),
    supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id),
    supabase
      .from("approval_gates")
      .select("id, status")
      .eq("project_id", id),
    supabase
      .from("analysis_runs")
      .select("id, title, analysis_type, results, interpretation")
      .eq("project_id", id)
      .eq("status", "completed")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const totalGates = gates?.length ?? 0;
  const approvedGates = gates?.filter((g) => g.status === "approved").length ?? 0;

  // Extract latest analysis data for preview cards
  const latestRun = latestRuns?.[0] ?? null
  type ForestRow = { name: string; value: number; ciLow: number; ciHigh: number; p: string }
  type KMPoint = { time: number; survival: number; ciLow: number; ciHigh: number; group: string }
  let forestRows: ForestRow[] = []
  let kmData: KMPoint[] = []
  let kmGroups: string[] = []
  let plainLanguage: string | null = null
  if (latestRun?.results) {
    const res = latestRun.results as Record<string, unknown>
    plainLanguage = (res.plainLanguage as string) ?? null
    const charts = (res.charts as Array<{ type: string; data: unknown[]; config?: Record<string, unknown> }>) ?? []
    const forestChart = charts.find(c =>
      ['forest_or', 'forest_hr', 'forest_irr', 'coefficient_plot'].includes(c.type)
    )
    if (forestChart?.data) {
      forestRows = (forestChart.data as Array<Record<string, unknown>>).map(d => ({
        name: String(d.name ?? ''),
        value: Number(d.or ?? d.hr ?? d.irr ?? d.estimate ?? 0),
        ciLow: Number(d.ciLow ?? 0),
        ciHigh: Number(d.ciHigh ?? 0),
        p: String(d.p ?? ''),
      }))
    } else {
      // Fall back to KM curve if no forest chart
      const kmChart = charts.find(c => c.type === 'km_curve')
      if (kmChart?.data) {
        kmData = (kmChart.data as Array<Record<string, unknown>>).map(d => ({
          time: Number(d.time ?? 0),
          survival: Number(d.survival ?? 0),
          ciLow: Number(d.ciLow ?? 0),
          ciHigh: Number(d.ciHigh ?? 0),
          group: String(d.group ?? 'All'),
        }))
        const configGroups = (kmChart.config as Record<string, unknown>)?.groups as string[] | undefined
        kmGroups = configGroups ?? [...new Set(kmData.map(d => d.group))]
      }
    }
  }

  const subLabels: Record<string, string> = {
    datasets: `${datasetCount ?? 0} Dataset${(datasetCount ?? 0) !== 1 ? "s" : ""} Active`,
    members: `${memberCount ?? 0} Active Researcher${(memberCount ?? 0) !== 1 ? "s" : ""}`,
    documents: `${docCount ?? 0} Document${(docCount ?? 0) !== 1 ? "s" : ""}`,
    analysis: "Compute Nodes Ready",
    field: "Coming Soon",
    settings: "All Services Operational",
    ethics: (ethicsCount ?? 0) > 0 ? `${ethicsCount} Application${(ethicsCount ?? 0) !== 1 ? "s" : ""}` : "No Pending Reviews",
    approvals: totalGates > 0 ? `${approvedGates}/${totalGates} Gates Approved` : "No Gates Set",
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] p-8">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* ── Hero & Metrics ── */}
        <div className="grid grid-cols-12 gap-6 items-stretch">

          {/* Hero Card */}
          <div className="col-span-12 lg:col-span-8 relative rounded-xl overflow-hidden flex items-end p-10 bg-slate-900 shadow-[0_20px_50px_rgba(0,24,72,0.08)] min-h-[300px]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#003d9b]/90 via-slate-900/80 to-slate-950" />
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 50%, #0052cc 0%, transparent 50%), radial-gradient(circle at 80% 20%, #1e40af 0%, transparent 40%)",
              }}
            />
            <div className="relative z-10 space-y-3 max-w-2xl">
              <span className="inline-block px-3 py-1 bg-[#0052cc] text-white text-[10px] font-bold uppercase tracking-widest rounded-md">
                {project.status.replace("_", " ")}
              </span>
              <h1 className="text-4xl font-bold text-white font-manrope tracking-tight leading-tight">
                {project.title}
              </h1>
              {project.description && (
                <p className="text-blue-100/70 text-sm leading-relaxed line-clamp-3">
                  {project.description}
                </p>
              )}
              {(project.start_date || project.end_date) && (
                <div className="flex items-center gap-5 pt-1">
                  {project.start_date && (
                    <span className="flex items-center gap-1.5 text-blue-200/60 text-xs font-medium">
                      <Calendar className="h-3 w-3" />
                      Start: {formatDate(project.start_date)}
                    </span>
                  )}
                  {project.end_date && (
                    <span className="flex items-center gap-1.5 text-blue-200/60 text-xs font-medium">
                      <Calendar className="h-3 w-3" />
                      End: {formatDate(project.end_date)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Metrics Column */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">

            {/* Documents metric */}
            <Link
              href={`/projects/${id}/documents`}
              className="bg-white rounded-xl p-6 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center justify-between group hover:border-[#003d9b]/20 hover:shadow-md transition-all duration-300"
            >
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documentation</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold text-[#003d9b] font-manrope">{docCount ?? 0}</h3>
                  <span className="text-xs text-slate-400 font-medium italic">Total docs</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-4xl text-slate-200 group-hover:text-[#003d9b] transition-colors duration-300">
                library_books
              </span>
            </Link>

            {/* Datasets metric */}
            <Link
              href={`/projects/${id}/data`}
              className="bg-white rounded-xl p-6 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center justify-between group hover:border-[#003d9b]/20 hover:shadow-md transition-all duration-300"
            >
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Datasets</p>
                <h3 className="text-3xl font-bold text-[#003d9b] font-manrope">{datasetCount ?? 0}</h3>
              </div>
              <span className="material-symbols-outlined text-4xl text-slate-200 group-hover:text-[#003d9b] transition-colors duration-300">
                database
              </span>
            </Link>

            {/* Compliance card */}
            <Link
              href={`/projects/${id}/approvals`}
              className="bg-[#003d9b] text-white rounded-xl p-6 shadow-xl shadow-[#003d9b]/10 flex flex-col justify-between border border-[#0052cc]/30 hover:bg-[#0052cc] transition-colors duration-300 flex-1"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-blue-200/70 uppercase tracking-widest">
                  Compliance Status
                </p>
                <span
                  className="material-symbols-outlined text-sm text-green-400"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified
                </span>
              </div>
              <p className="text-sm font-medium leading-snug mb-3">
                {totalGates > 0
                  ? `${approvedGates} of ${totalGates} approval gates cleared.`
                  : "No approval gates configured yet."}
              </p>
              <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                <div>
                  <p className="text-[9px] uppercase tracking-tighter text-blue-200/70 font-bold">Ethics</p>
                  <p className="text-lg font-bold font-manrope">{ethicsCount ?? 0}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-tighter text-blue-200/70 font-bold">Gates</p>
                  <p className="text-lg font-bold font-manrope">{totalGates}</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* ── Core Infrastructure ── */}
        <div className="space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[#191c1e] font-manrope">
                Core Infrastructure
              </h2>
              <p className="text-slate-500 text-sm mt-0.5">
                Select a module to manage your research operations
              </p>
            </div>
            <div className="flex gap-2">
              <div className="h-1 w-12 bg-[#003d9b] rounded-full" />
              <div className="h-1 w-4 bg-slate-200 rounded-full" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {modules(id).map(({ href, title, materialIcon, subKey }) => (
              <Link
                key={href}
                href={href}
                className="bg-white p-8 rounded-xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-lg hover:border-[#003d9b]/20 transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-[#003d9b] transition-colors duration-300">
                  <span className="material-symbols-outlined text-[#003d9b] group-hover:text-white transition-colors duration-300">
                    {materialIcon}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-[#191c1e] font-manrope mb-1 leading-snug">
                      {title}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium tracking-tight">
                      {subLabels[subKey]}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#003d9b] group-hover:translate-x-0.5 transition-all duration-300 flex-shrink-0 mt-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Latest Analysis Cards ── */}
        {latestRun && (
          <LatestAnalysisCards
            projectId={id}
            runId={latestRun.id}
            runTitle={latestRun.title}
            analysisType={latestRun.analysis_type}
            forestRows={forestRows}
            kmData={kmData}
            kmGroups={kmGroups}
            plainLanguage={plainLanguage}
            interpretation={latestRun.interpretation}
          />
        )}

      </div>
    </div>
  );
}

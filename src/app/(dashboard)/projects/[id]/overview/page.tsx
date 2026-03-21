import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { FileText, ShieldCheck, Calendar, Pencil } from "lucide-react";

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

  const [{ count: docCount }, { count: ethicsCount }] = await Promise.all([
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id)
      .is("deleted_at", null),
    supabase
      .from("ethics_applications")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id),
  ]);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
        <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors">
          <Pencil className="h-3.5 w-3.5" />
          Edit project
        </button>
      </div>

      {project.description && (
        <p className="text-gray-600 mb-6 leading-relaxed">{project.description}</p>
      )}

      {/* Dates */}
      {(project.start_date || project.end_date) && (
        <div className="flex items-center gap-6 mb-6 text-sm text-gray-500">
          {project.start_date && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>Start: {formatDate(project.start_date)}</span>
            </div>
          )}
          {project.end_date && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>End: {formatDate(project.end_date)}</span>
            </div>
          )}
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link
          href={`/projects/${id}/documents`}
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-200 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 rounded-lg p-2">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{docCount ?? 0}</p>
              <p className="text-sm text-gray-500">Documents</p>
            </div>
          </div>
        </Link>

        <Link
          href={`/projects/${id}/ethics`}
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-green-200 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="bg-green-50 rounded-lg p-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{ethicsCount ?? 0}</p>
              <p className="text-sm text-gray-500">Ethics applications</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Created date */}
      <p className="text-xs text-gray-400">
        Project created {formatDate(project.created_at)}
      </p>
    </div>
  );
}

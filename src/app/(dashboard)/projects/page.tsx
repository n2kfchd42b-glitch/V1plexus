import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Plus, FolderOpen, Clock } from "lucide-react";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: owned } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  const { data: memberRows } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id);

  const memberProjectIds = memberRows?.map((r) => r.project_id) ?? [];
  const { data: memberProjects } = memberProjectIds.length
    ? await supabase
        .from("projects")
        .select("*")
        .in("id", memberProjectIds)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
    : { data: [] };

  const allProjects = [
    ...(owned ?? []),
    ...(memberProjects ?? []).filter(
      (p) => !owned?.some((o) => o.id === p.id)
    ),
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <Link
          href="/projects/new"
          className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </div>

      {allProjects.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <FolderOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="font-medium text-gray-700">No projects yet</h3>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Create your first research project
          </p>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allProjects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}/overview`}
              className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{project.title}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    project.status === "active"
                      ? "bg-green-100 text-green-700"
                      : project.status === "completed"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {project.status.replace("_", " ")}
                </span>
              </div>
              {project.description && (
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                  {project.description}
                </p>
              )}
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="h-3 w-3" />
                Updated {formatDate(project.updated_at)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

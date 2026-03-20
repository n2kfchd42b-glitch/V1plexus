import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Plus, FolderOpen, Clock } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {profile?.full_name ?? user.email}
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s an overview of your research.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total projects</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {projects?.length ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">
            {projects?.filter((p) => p.status === "active").length ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {projects?.filter((p) => p.status === "completed").length ?? 0}
          </p>
        </div>
      </div>

      {/* Recent projects */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Your projects</h2>
        <Link
          href="/projects/new"
          className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </div>

      {!projects || projects.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <FolderOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="font-medium text-gray-700">No projects yet</h3>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Create your first research project to get started
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
        <div className="space-y-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}/overview`}
              className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{project.title}</h3>
                  {project.description && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                      {project.description}
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    project.status === "active"
                      ? "bg-green-100 text-green-700"
                      : project.status === "completed"
                      ? "bg-blue-100 text-blue-700"
                      : project.status === "on_hold"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {project.status.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
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

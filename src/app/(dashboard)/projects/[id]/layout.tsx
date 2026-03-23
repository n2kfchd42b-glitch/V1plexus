import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProjectTabNav } from "@/components/layout/ProjectTabNav";
import { THESIS_ENABLED } from "@/lib/flags";

export default async function ProjectWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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
    .is("deleted_at", null)
    .single();

  if (!project) notFound();

  // Detect if this is a thesis project — only when the feature is enabled
  let isThesis = false;
  if (THESIS_ENABLED) {
    try {
      const { data: meta } = await supabase
        .from("thesis_metadata")
        .select("id")
        .eq("project_id", id)
        .maybeSingle();
      isThesis = !!meta;
    } catch {
      isThesis = false;
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Project header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/projects" className="hover:text-gray-900">Projects</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{project.title}</span>
          {isThesis && (
            <>
              <span>/</span>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                Thesis
              </span>
            </>
          )}
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">{project.title}</h1>
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
      </div>

      {/* Tabs */}
      <ProjectTabNav projectId={id} isThesis={isThesis} />

      {/* Content */}
      <div className="flex-1 bg-gray-50">{children}</div>
    </div>
  );
}

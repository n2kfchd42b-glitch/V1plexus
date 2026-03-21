import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProjectTabNav } from "@/components/layout/ProjectTabNav";

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

  return (
    <div className="flex flex-col min-h-screen">
      {/* Project header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/projects" className="hover:text-gray-900">Projects</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{project.title}</span>
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
      <ProjectTabNav projectId={id} />

      {/* Content */}
      <div className="flex-1 bg-gray-50">{children}</div>
    </div>
  );
}

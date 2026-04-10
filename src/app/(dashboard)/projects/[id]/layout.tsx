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
      {/* Project breadcrumb */}
      <div className="bg-[var(--bg-app)] border-b border-[var(--border-subtle)] px-6 py-2.5 flex items-center gap-2 text-xs text-[var(--text-tertiary)] flex-shrink-0">
        <Link href="/dashboard" className="hover:text-[var(--text-secondary)] transition-colors duration-150">
          Projects
        </Link>
        <span>/</span>
        <span className="text-[var(--text-secondary)] font-medium truncate max-w-xs">
          {project.title}
        </span>
      </div>

      {/* Tab navigation */}
      <ProjectTabNav projectId={id} />

      {/* Page content */}
      <div className="flex-1 min-h-0 bg-[var(--bg-app)]">
        {children}
      </div>
    </div>
  );
}

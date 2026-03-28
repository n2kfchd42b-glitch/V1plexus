import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
      {/* Project breadcrumb */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-8 py-3 shadow-[0_1px_0_rgba(0,24,72,0.04)]">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/projects" className="hover:text-[#003d9b] transition-colors font-medium">
            Projects
          </Link>
          <span>/</span>
          <span className="text-slate-600 font-medium">{project.title}</span>
          {isThesis && (
            <>
              <span>/</span>
              <span className="text-[10px] font-bold text-[#003d9b] bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                Thesis
              </span>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-[#f7f9fb]">{children}</div>
    </div>
  );
}

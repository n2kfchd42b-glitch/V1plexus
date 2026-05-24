import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CommitteePanel } from "@/components/thesis/CommitteePanel";
import { ProjectSupervisorAccess } from "@/components/supervisor-student/ProjectSupervisorAccess";
import type { ThesisCommittee } from "@/types/database";
import { THESIS_ENABLED } from "@/lib/flags";
import { GraduationCap } from "lucide-react";

export default async function ThesisSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!THESIS_ENABLED) redirect(`/projects/${id}/overview`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, owner_id, project_type")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const isThesis = (project as { project_type?: string }).project_type === "thesis";
  if (!isThesis) redirect(`/projects/${id}/overview`);

  const { data: committeeData } = await supabase
    .from("thesis_committees")
    .select("*")
    .eq("project_id", id)
    .neq("status", "removed")
    .order("created_at", { ascending: true });

  const members = (committeeData as ThesisCommittee[]) ?? [];
  const canEdit = project.owner_id === user.id;

  return (
    <div className="h-[calc(100vh-6.5rem)] overflow-y-auto">
    <div className="px-6 py-6 max-w-2xl mx-auto space-y-8">

      {/* Supervisor — reuses the same component as the Team page */}
      <div className="border border-[var(--border-default)] rounded-2xl p-5 bg-[var(--bg-surface)]">
        <div className="flex items-start gap-2.5 mb-4">
          <div className="h-8 w-8 rounded-lg bg-[var(--accent-blue-subtle)] flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-4 w-4 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Supervisors</h3>
            <p className="text-xs text-[var(--text-tertiary)]">
              Grant your supervisors read-only access to this project&apos;s data and documents
            </p>
          </div>
        </div>
        <ProjectSupervisorAccess projectId={id} />
      </div>

      {/* Committee */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide mb-3 text-[var(--text-tertiary)]">
          Committee
        </h2>
        <CommitteePanel
          projectId={id}
          members={members}
          canEdit={canEdit}
        />
      </div>

    </div>
    </div>
  );
}

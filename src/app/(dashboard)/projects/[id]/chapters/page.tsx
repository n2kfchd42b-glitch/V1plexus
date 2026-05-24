import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChapterList } from "@/components/thesis/ChapterList";
import { ThesisRightPanel } from "@/components/thesis/ThesisRightPanel";
import type { ThesisChapter } from "@/types/database";
import { THESIS_ENABLED } from "@/lib/flags";

export default async function ChaptersPage({
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
    .select("id, title, owner_id")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const [{ data: chaptersData }, { data: assignmentData }] = await Promise.all([
    supabase
      .from("thesis_chapters")
      .select("*")
      .eq("project_id", id)
      .order("sort_order", { ascending: true }),
    // Use the existing supervisor-student system for the supervisor name
    supabase
      .from("supervisor_assignments")
      .select("supervisor:profiles!supervisor_id(full_name)")
      .eq("student_id", project.owner_id)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const chapters = (chaptersData as ThesisChapter[]) ?? [];
  const canEdit = project.owner_id === user.id;
  const approvedChapters = chapters.filter(c => c.status === "approved").length;
  const supervisorName = (assignmentData as { supervisor?: { full_name: string | null } | null } | null)?.supervisor?.full_name ?? null;

  return (
    <div className="h-[calc(100vh-6.5rem)] overflow-y-auto">
      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Thesis Workspace
              </h2>
              {supervisorName && (
                <p className="text-xs mt-0.5 text-[var(--text-tertiary)]">
                  Supervised by {supervisorName}
                </p>
              )}
            </div>
            <span className="text-xs text-[var(--text-tertiary)]">
              {chapters.length} chapter{chapters.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-[1fr_272px] gap-6 items-start">

            {/* Left: chapter list */}
            <div>
              {chapters.length === 0 ? (
                <div className="text-center py-16 rounded-lg border border-dashed bg-[var(--bg-surface)] border-[var(--border-default)]">
                  <p className="text-sm mb-1 text-[var(--text-secondary)]">No chapters yet.</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Chapters are created when you set up this project as a thesis workspace.
                  </p>
                </div>
              ) : (
                <ChapterList
                  projectId={id}
                  chapters={chapters}
                  canEdit={canEdit}
                />
              )}
            </div>

            {/* Right: supervisor notes, progress, sessions, audit */}
            <div className="sticky top-6">
              <ThesisRightPanel
                projectId={id}
                userId={user.id}
                supervisorName={supervisorName}
                approvedChapters={approvedChapters}
                totalChapters={chapters.length}
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

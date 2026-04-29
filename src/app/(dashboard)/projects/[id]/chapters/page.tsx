import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChapterList } from "@/components/thesis/ChapterList";
import { ThesisChapter } from "@/lib/types/thesis";
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

  // Fetch thesis metadata to confirm this is a thesis project
  let chapters: ThesisChapter[] = [];
  try {
    const { data } = await supabase
      .from("thesis_chapters")
      .select("*")
      .eq("project_id", id)
      .order("sort_order", { ascending: true });
    chapters = (data as ThesisChapter[]) ?? [];
  } catch {
    // Migration not yet applied — show empty state
  }

  const canEdit = project.owner_id === user.id;

  return (
    <div className="px-6 py-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-gray-900">Chapters</h2>
        <span className="text-xs text-gray-400">{chapters.length} chapter{chapters.length !== 1 ? "s" : ""}</span>
      </div>

      {chapters.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-500 mb-2">No chapters yet.</p>
          <p className="text-xs text-gray-400">
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
  );
}

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProgressDashboard } from "@/components/thesis/ProgressDashboard";
import { ThesisChapter, ThesisMetadata, ThesisDefense } from "@/lib/types/thesis";
import { THESIS_ENABLED } from "@/lib/flags";

export default async function ProgressPage({
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
    .select("id, title")
    .eq("id", id)
    .single();
  if (!project) notFound();

  let metadata: ThesisMetadata | null = null;
  let chapters: ThesisChapter[] = [];
  let defense: ThesisDefense | null = null;

  try {
    const [metaResult, chapResult, defResult] = await Promise.all([
      supabase
        .from("thesis_metadata")
        .select("*")
        .eq("project_id", id)
        .maybeSingle(),
      supabase
        .from("thesis_chapters")
        .select("*")
        .eq("project_id", id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("thesis_defenses")
        .select("*")
        .eq("project_id", id)
        .eq("defense_type", "final")
        .maybeSingle(),
    ]);
    metadata = (metaResult.data as ThesisMetadata) ?? null;
    chapters = (chapResult.data as ThesisChapter[]) ?? [];
    defense = (defResult.data as ThesisDefense) ?? null;
  } catch {
    // Migration not yet applied
  }

  return (
    <div className="px-6 py-6 max-w-4xl">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900">Thesis Progress</h2>
      </div>
      <ProgressDashboard
        metadata={metadata}
        chapters={chapters}
        defense={defense}
      />
    </div>
  );
}

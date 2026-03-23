import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DefenseManager } from "@/components/thesis/DefenseManager";
import { ThesisChapter, ThesisCommittee, ThesisDefense, ThesisMetadata } from "@/lib/types/thesis";

export default async function DefensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, owner_id")
    .eq("id", id)
    .single();
  if (!project) notFound();

  let metadata: ThesisMetadata | null = null;
  let chapters: ThesisChapter[] = [];
  let committee: ThesisCommittee[] = [];
  let defense: ThesisDefense | null = null;

  try {
    const [metaRes, chapRes, commRes, defRes] = await Promise.all([
      supabase.from("thesis_metadata").select("*").eq("project_id", id).maybeSingle(),
      supabase.from("thesis_chapters").select("*").eq("project_id", id).order("sort_order"),
      supabase.from("thesis_committees").select("*").eq("project_id", id).neq("status", "removed"),
      supabase.from("thesis_defenses").select("*").eq("project_id", id).eq("defense_type", "final").maybeSingle(),
    ]);
    metadata  = (metaRes.data as ThesisMetadata)   ?? null;
    chapters  = (chapRes.data as ThesisChapter[])  ?? [];
    committee = (commRes.data as ThesisCommittee[]) ?? [];
    defense   = (defRes.data as ThesisDefense)     ?? null;
  } catch {
    // Migration not yet applied
  }

  const canEdit = project.owner_id === user.id;

  return (
    <div className="px-6 py-6 max-w-3xl">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900">Defense Management</h2>
      </div>
      <DefenseManager
        projectId={id}
        metadata={metadata}
        defense={defense}
        chapters={chapters}
        committee={committee}
        canEdit={canEdit}
      />
    </div>
  );
}

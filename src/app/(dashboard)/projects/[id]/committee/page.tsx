import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CommitteePanel } from "@/components/thesis/CommitteePanel";
import { ThesisCommittee } from "@/lib/types/thesis";

export default async function CommitteePage({
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

  let members: ThesisCommittee[] = [];
  try {
    const { data } = await supabase
      .from("thesis_committees")
      .select("*")
      .eq("project_id", id)
      .neq("status", "removed")
      .order("created_at", { ascending: true });
    members = (data as ThesisCommittee[]) ?? [];
  } catch {
    // Migration not yet applied
  }

  const canEdit = project.owner_id === user.id;

  return (
    <div className="px-6 py-6 max-w-3xl">
      <CommitteePanel
        projectId={id}
        members={members}
        canEdit={canEdit}
      />
    </div>
  );
}

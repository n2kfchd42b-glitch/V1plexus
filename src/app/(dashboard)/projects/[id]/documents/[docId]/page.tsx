import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentEditor } from "@/components/document/DocumentEditor";

export default async function DocumentEditorPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id, docId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: document } = await supabase
    .from("documents")
    .select("*")
    .eq("id", docId)
    .eq("project_id", id)
    .is("deleted_at", null)
    .single();

  if (!document) notFound();

  const { data: versions } = await supabase
    .from("document_versions")
    .select("*")
    .eq("document_id", docId)
    .order("version_number", { ascending: true });

  return (
    <DocumentEditor
      document={document}
      projectId={id}
      initialVersions={versions ?? []}
    />
  );
}

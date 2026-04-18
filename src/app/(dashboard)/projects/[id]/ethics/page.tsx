import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EthicsPanel } from "@/components/ethics/EthicsPanel";

export default async function EthicsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: application } = await supabase
    .from("ethics_applications")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const applicationId = application?.id;

  const [amendmentsResult, documentsResult] = await Promise.all([
    applicationId
      ? supabase
          .from("ethics_amendments")
          .select("*")
          .eq("application_id", applicationId)
          .order("created_at", { ascending: true })
      : { data: [] },
    applicationId
      ? supabase
          .from("ethics_documents")
          .select("*")
          .eq("application_id", applicationId)
          .order("created_at", { ascending: true })
      : { data: [] },
  ]);

  return (
    <EthicsPanel
      projectId={id}
      initialApplication={application ?? null}
      initialAmendments={amendmentsResult.data ?? []}
      initialDocuments={documentsResult.data ?? []}
    />
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DocumentsGrid } from "@/components/document/DocumentsGrid";
import { Plus, FileText } from "lucide-react";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {documents?.length ?? 0} document{documents?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href={`/projects/${id}/documents/new`}
          className="flex items-center gap-1.5 bg-clinical-blue text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-clinical-deep transition-colors"
        >
          <Plus className="h-4 w-4" />
          New document
        </Link>
      </div>

      {!documents || documents.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-medium text-slate-700">No documents yet</h3>
          <p className="text-sm text-slate-400 mt-1 mb-4">
            Create your first document for this project
          </p>
          <Link
            href={`/projects/${id}/documents/new`}
            className="inline-flex items-center gap-1.5 bg-clinical-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-clinical-deep"
          >
            <Plus className="h-4 w-4" />
            Create document
          </Link>
        </div>
      ) : (
        <DocumentsGrid documents={documents} projectId={id} />
      )}
    </div>
  );
}

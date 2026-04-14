import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DocumentListPanel } from "@/components/document/DocumentListPanel"

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: documents } = await supabase
    .from("documents")
    .select("id")
    .eq("project_id", id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)

  // If there's an existing document, open it directly
  if (documents && documents.length > 0) {
    redirect(`/projects/${id}/documents/${documents[0].id}`)
  }

  // No documents yet — show the list panel with an empty state on the right
  return (
    <div className="flex h-screen bg-bg-app overflow-hidden">
      <DocumentListPanel projectId={id} selectedDocId="" />
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
        <svg
          className="h-10 w-10 text-text-tertiary opacity-30"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
        <p className="text-sm font-medium text-text-secondary">No documents yet</p>
        <p className="text-xs text-text-tertiary max-w-[200px]">
          Create your first document using the panel on the left
        </p>
      </div>
    </div>
  )
}

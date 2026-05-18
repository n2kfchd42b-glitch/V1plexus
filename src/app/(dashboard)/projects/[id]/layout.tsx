import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: { user } }, projectResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("projects")
      .select("id, owner_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
  ]);

  if (!user) redirect("/login");
  if (!projectResult.data) notFound();

  const project = projectResult.data;

  // Owner — full access
  if (project.owner_id === user.id) {
    return <div className="flex flex-col min-h-screen">{children}</div>;
  }

  // Non-owner — check membership
  const { data: member } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  // Supervisors (viewers) get a purpose-built read-only hub, not the student workspace
  if (member?.role === "viewer") {
    redirect(`/supervisor/projects/${id}`);
  }

  // Other project members (co-PI, researcher) — allow through
  if (member) {
    return <div className="flex flex-col min-h-screen">{children}</div>;
  }

  // No access at all
  notFound();
}

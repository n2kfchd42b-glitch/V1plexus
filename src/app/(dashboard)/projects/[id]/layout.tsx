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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!project) notFound();

  return (
    <div className="flex flex-col min-h-screen">
      {children}
    </div>
  );
}

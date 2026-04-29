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
    supabase.from("projects").select("id").eq("id", id).is("deleted_at", null).single(),
  ]);

  if (!user) redirect("/login");
  if (!projectResult.data) notFound();

  return (
    <div className="flex flex-col min-h-screen">
      {children}
    </div>
  );
}

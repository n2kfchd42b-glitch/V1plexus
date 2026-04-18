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

  // Middleware already verified auth — getSession() reads the cookie locally.
  const [{ data: { session } }, projectResult] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from("projects").select("id").eq("id", id).is("deleted_at", null).single(),
  ]);

  if (!session) redirect("/login");
  if (!projectResult.data) notFound();

  return (
    <div className="flex flex-col min-h-screen">
      {children}
    </div>
  );
}

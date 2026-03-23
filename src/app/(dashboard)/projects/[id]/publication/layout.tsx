import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PUBLICATION_ENABLED } from "@/lib/flags";

export default async function PublicationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!PUBLICATION_ENABLED) redirect(`/projects/${id}/overview`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <>{children}</>;
}

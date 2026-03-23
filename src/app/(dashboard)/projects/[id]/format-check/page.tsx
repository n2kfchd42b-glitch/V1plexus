import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FormatChecker } from "@/components/thesis/FormatChecker";
import { FormatRule } from "@/lib/types/thesis";

export default async function FormatCheckPage({
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
    .select("id, title, institution_id")
    .eq("id", id)
    .single();
  if (!project) notFound();

  let formatRules: FormatRule[] = [];
  try {
    if (project.institution_id) {
      const { data } = await supabase
        .from("format_rules")
        .select("*")
        .eq("institution_id", project.institution_id)
        .eq("is_active", true)
        .order("created_at");
      formatRules = (data as FormatRule[]) ?? [];
    }
  } catch {
    // Migration not yet applied
  }

  return (
    <div className="px-6 py-6 max-w-3xl">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900">Format Compliance</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Check your thesis document against institutional formatting requirements.
        </p>
      </div>
      <FormatChecker projectId={id} formatRules={formatRules} />
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ThesisCreationWizard } from "@/components/thesis/ThesisCreationWizard";
import { ArrowLeft } from "lucide-react";
import { THESIS_ENABLED } from "@/lib/flags";

export default async function NewThesisPage() {
  if (!THESIS_ENABLED) redirect("/projects");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-[var(--bg-app)] px-4 py-10">
      <div className="max-w-xl mx-auto">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">New Thesis Project</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            Create a structured workspace for your thesis or dissertation
          </p>
        </div>

        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] shadow-sm px-8 py-8">
          <ThesisCreationWizard />
        </div>
      </div>
    </div>
  );
}

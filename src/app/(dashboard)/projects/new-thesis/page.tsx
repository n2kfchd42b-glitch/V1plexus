import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ThesisCreationWizard } from "@/components/thesis/ThesisCreationWizard";
import { ArrowLeft } from "lucide-react";

export default async function NewThesisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-xl mx-auto">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">New Thesis Project</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create a structured workspace for your thesis or dissertation
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-8 py-8">
          <ThesisCreationWizard />
        </div>
      </div>
    </div>
  );
}

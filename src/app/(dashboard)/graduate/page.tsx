import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GraduateCoordinatorDash } from "@/components/thesis/GraduateCoordinatorDash";
import { CoordinatorThesisRow, DegreeType } from "@/lib/types/thesis";
import { THESIS_ENABLED } from "@/lib/flags";

export default async function GraduateDashboardPage() {
  if (!THESIS_ENABLED) redirect("/dashboard");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch user profile for department/institution context
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, departments(name), institutions(name)")
    .eq("id", user.id)
    .single();

  const departmentName =
    (profile as { departments?: { name: string } | null })?.departments?.name ??
    (profile as { institutions?: { name: string } | null })?.institutions?.name ??
    "Your Department";

  let students: CoordinatorThesisRow[] = [];

  try {
    // Join thesis_metadata → projects → project_members → profiles
    const { data: theses } = await supabase
      .from("thesis_metadata")
      .select(`
        project_id,
        degree_type,
        thesis_title,
        expected_completion,
        defense_status,
        projects (
          id,
          title,
          owner_id,
          profiles!projects_owner_id_fkey (
            full_name
          )
        ),
        thesis_chapters (
          id,
          title,
          chapter_number,
          status,
          target_date
        )
      `);

    if (theses) {
      students = theses.map((t: any) => {
        const chapters = (t.thesis_chapters ?? []) as {
          status: string;
          target_date: string | null;
          chapter_number: number;
          title: string;
        }[];
        const total = chapters.length;
        const approved = chapters.filter(c => c.status === "approved" || c.status === "locked").length;
        const percent = total > 0 ? Math.round((approved / total) * 100) : 0;
        const now = new Date();

        const overdueChapters = chapters.filter(c =>
          c.target_date &&
          new Date(c.target_date) < now &&
          c.status !== "approved" &&
          c.status !== "locked"
        );

        const inProgress = chapters.find(c =>
          ["drafting", "submitted_for_review", "revision_requested"].includes(c.status)
        );

        let statusLabel: CoordinatorThesisRow["status_label"] = "on_track";
        let alertMessage: string | undefined;

        if (percent >= 90) {
          statusLabel = "near_completion";
        } else if (overdueChapters.length >= 2) {
          statusLabel = "at_risk";
          alertMessage = `${overdueChapters.length} chapters overdue`;
        } else if (overdueChapters.length === 1) {
          statusLabel = "behind";
          alertMessage = `Chapter ${overdueChapters[0].chapter_number} overdue`;
        } else if (total === 0 || (percent === 0 && t.expected_completion)) {
          // Check if enrolled for > 6 months with 0 progress
          const expectedDate = t.expected_completion ? new Date(t.expected_completion) : null;
          if (expectedDate && expectedDate.getTime() - now.getTime() < 6 * 30 * 24 * 60 * 60 * 1000) {
            statusLabel = "at_risk";
            alertMessage = "No chapters started, nearing deadline";
          }
        }

        return {
          project_id: t.project_id,
          student_name: t.projects?.profiles?.full_name ?? "Unknown Student",
          thesis_title: t.thesis_title ?? t.projects?.title ?? null,
          degree_type: (t.degree_type as DegreeType) ?? "msc",
          supervisor_name: null, // TODO: join supervisor from project_members
          progress_percent: percent,
          status_label: statusLabel,
          current_chapter: inProgress
            ? `Ch ${inProgress.chapter_number}: ${inProgress.title} (${inProgress.status.replace(/_/g, " ")})`
            : approved === total && total > 0
              ? "All chapters approved"
              : null,
          expected_completion: t.expected_completion
            ? new Date(t.expected_completion).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
            : null,
          defense_status: t.defense_status,
          alert_message: alertMessage,
        } satisfies CoordinatorThesisRow;
      });
    }
  } catch {
    // Migration not yet applied — show empty state
  }

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <GraduateCoordinatorDash
        departmentName={departmentName}
        students={students}
      />
    </div>
  );
}

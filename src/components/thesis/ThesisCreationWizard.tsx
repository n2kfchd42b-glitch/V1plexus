"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, GripVertical, Trash2, Plus, GraduationCap, Info } from "lucide-react";
import { DegreeType, DEGREE_LABELS, DEFAULT_CHAPTERS_BY_DEGREE } from "@/lib/types/thesis";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ThesisCreationWizardProps {
  workspaceId?: string;
  onCancel?: () => void;
}

interface ChapterDraft {
  title: string;
  tempId: string;
}

const PROGRAMS = [
  "Epidemiology", "Biostatistics", "Global Health", "Public Health",
  "Health Policy", "Environmental Health", "Infectious Diseases",
  "Maternal & Child Health", "Health Systems", "Other",
];

const STEPS = ["Basic Info", "Thesis Details", "Chapter Structure", "Committee"] as const;

export function ThesisCreationWizard({ onCancel }: ThesisCreationWizardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: Basic info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Step 2: Thesis details
  const [degreeType, setDegreeType] = useState<DegreeType>("msc");
  const [program, setProgram] = useState("");
  const [customProgram, setCustomProgram] = useState("");
  const [enrollmentDate, setEnrollmentDate] = useState("");
  const [expectedCompletion, setExpectedCompletion] = useState("");

  // Step 3: Chapters
  const [chapters, setChapters] = useState<ChapterDraft[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Step 4: Committee
  const [committeeMembers, setCommitteeMembers] = useState<
    { name: string; email: string; role: string; institution: string }[]
  >([]);

  function initChapters(degree: DegreeType) {
    const defaults = DEFAULT_CHAPTERS_BY_DEGREE[degree];
    setChapters(defaults.map((t, i) => ({ title: t, tempId: `ch-${i}` })));
  }

  function handleDegreeChange(d: DegreeType) {
    setDegreeType(d);
    initChapters(d);
  }

  function addChapter() {
    setChapters(prev => [...prev, { title: "", tempId: `ch-${Date.now()}` }]);
  }

  function removeChapter(idx: number) {
    setChapters(prev => prev.filter((_, i) => i !== idx));
  }

  function updateChapter(idx: number, title: string) {
    setChapters(prev => prev.map((c, i) => i === idx ? { ...c, title } : c));
  }

  function handleDragStart(idx: number) {
    setDragIndex(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === idx) return;
    const reordered = [...chapters];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(idx, 0, moved);
    setChapters(reordered);
    setDragIndex(idx);
  }

  function addCommitteeMember() {
    setCommitteeMembers(prev => [...prev, { name: "", email: "", role: "member", institution: "" }]);
  }

  function updateMember(idx: number, field: string, value: string) {
    setCommitteeMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  function removeMember(idx: number) {
    setCommitteeMembers(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate() {
    if (!user) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const resolvedProgram = program === "Other" ? customProgram.trim() : program;

      // 1. Create the project
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          owner_id: user.id,
          project_type: "thesis",
          status: "active",
        })
        .select("id")
        .single();
      if (projectError || !project) throw new Error(projectError?.message ?? "Failed to create project");

      // 2. Insert thesis_metadata
      const { error: metaError } = await supabase
        .from("thesis_metadata")
        .insert({
          project_id: project.id,
          degree_type: degreeType,
          program_name: resolvedProgram,
          thesis_title: title.trim(),
          supervisor_id: null,
          enrollment_date: enrollmentDate || null,
          expected_completion: expectedCompletion || null,
          defense_status: "not_scheduled",
        });
      if (metaError) throw new Error(metaError.message);

      // 3. Insert thesis_chapters
      if (chapters.length > 0) {
        const { error: chaptersError } = await supabase
          .from("thesis_chapters")
          .insert(
            chapters.map((c, i) => ({
              project_id: project.id,
              chapter_number: i + 1,
              title: c.title.trim(),
              status: "not_started",
              sort_order: i,
            }))
          );
        if (chaptersError) throw new Error(chaptersError.message);
      }

      router.push(`/projects/${project.id}/chapters`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setSaving(false);
    }
  }

  const canProceedStep0 = title.trim().length >= 3;
  const canProceedStep1 = degreeType && (program !== "Other" ? program : customProgram.trim());
  const canProceedStep2 = chapters.length > 0 && chapters.every(c => c.title.trim());

  const canProceed = [canProceedStep0, canProceedStep1, canProceedStep2, true][step];

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold border-2 transition-all ${
              i < step ? "bg-[var(--accent-blue)] border-[var(--accent-blue)] text-white" :
              i === step ? "border-[var(--accent-blue)] text-[var(--accent-blue)]" :
              "border-[var(--border-default)] text-[var(--text-tertiary)]"
            }`}>
              {i < step ? "✓" : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${i < step ? "bg-[var(--accent-blue)]" : "bg-[var(--bg-surface-active)]"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{STEPS[step]}</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          {["Enter basic project information", "Configure thesis-specific details", "Set up chapter structure", "Add committee members (optional)"][step]}
        </p>
      </div>

      {/* Step 0: Basic Info */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Thesis / Dissertation Title *</label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Malaria Prevalence in Northern Ghana 2020–2024"
              className="w-full text-sm border border-[var(--border-default)] rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief description of the research..."
              className="w-full text-sm border border-[var(--border-default)] rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] resize-none"
            />
          </div>
        </div>
      )}

      {/* Step 1: Thesis Details */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Degree Type *</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(DEGREE_LABELS) as [DegreeType, string][]).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleDegreeChange(val)}
                  className={`py-2 text-sm font-medium rounded border transition-colors ${
                    degreeType === val
                      ? "bg-[var(--accent-blue)] text-white border-[var(--accent-blue)]"
                      : "bg-white text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Program / Specialization *</label>
            <select
              value={program}
              onChange={e => setProgram(e.target.value)}
              className="w-full text-sm border border-[var(--border-default)] rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
            >
              <option value="">Select a program...</option>
              {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {program === "Other" && (
              <input
                type="text"
                autoFocus
                value={customProgram}
                onChange={e => setCustomProgram(e.target.value)}
                placeholder="Enter program name..."
                className="w-full text-sm border border-[var(--border-default)] rounded px-3 py-2 mt-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Enrollment Date</label>
              <input
                type="date"
                value={enrollmentDate}
                onChange={e => setEnrollmentDate(e.target.value)}
                className="w-full text-sm border border-[var(--border-default)] rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Expected Completion</label>
              <input
                type="date"
                value={expectedCompletion}
                onChange={e => setExpectedCompletion(e.target.value)}
                className="w-full text-sm border border-[var(--border-default)] rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              />
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-[var(--border-status-info)] bg-[var(--accent-blue-subtle)] px-3.5 py-3">
            <Info className="h-3.5 w-3.5 text-[var(--accent-blue)] mt-0.5 shrink-0" />
            <p className="text-xs text-[var(--accent-blue-hover)] leading-relaxed">
              You can invite your supervisor from the <span className="font-semibold">Setup</span> tab once the project is created.
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Chapters */}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-tertiary)]">
            Pre-filled based on {DEGREE_LABELS[degreeType]} requirements. Drag to reorder, edit titles as needed.
          </p>
          <div className="space-y-2">
            {chapters.map((ch, idx) => (
              <div
                key={ch.tempId}
                className="flex items-center gap-2"
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
              >
                <div className="cursor-grab text-[var(--border-strong)] hover:text-[var(--text-tertiary)]">
                  <GripVertical className="h-4 w-4" />
                </div>
                <span className="text-xs text-[var(--text-tertiary)] w-6 shrink-0">{idx + 1}.</span>
                <input
                  type="text"
                  value={ch.title}
                  onChange={e => updateChapter(idx, e.target.value)}
                  placeholder={`Chapter ${idx + 1} title...`}
                  className="flex-1 text-sm border border-[var(--border-default)] rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                />
                <button
                  onClick={() => removeChapter(idx)}
                  className="text-[var(--border-strong)] hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addChapter}
            className="flex items-center gap-1.5 text-sm text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)] font-medium mt-1"
          >
            <Plus className="h-4 w-4" />
            Add Chapter
          </button>
        </div>
      )}

      {/* Step 3: Committee */}
      {step === 3 && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-tertiary)]">
            Optionally add committee members now. You can also do this later from the Committee tab.
          </p>
          {committeeMembers.map((m, idx) => (
            <div key={idx} className="rounded-lg border border-[var(--border-default)] p-3 space-y-2 relative">
              <button
                onClick={() => removeMember(idx)}
                className="absolute top-2 right-2 text-[var(--border-strong)] hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Full name"
                  value={m.name}
                  onChange={e => updateMember(idx, "name", e.target.value)}
                  className="text-sm border border-[var(--border-default)] rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                />
                <select
                  value={m.role}
                  onChange={e => updateMember(idx, "role", e.target.value)}
                  className="text-sm border border-[var(--border-default)] rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                >
                  <option value="chair">Chair</option>
                  <option value="co_chair">Co-Chair</option>
                  <option value="member">Member</option>
                  <option value="external_examiner">External Examiner</option>
                  <option value="advisor">Advisor</option>
                </select>
              </div>
              <input
                type="email"
                placeholder="Email address"
                value={m.email}
                onChange={e => updateMember(idx, "email", e.target.value)}
                className="w-full text-sm border border-[var(--border-default)] rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
              />
              <input
                type="text"
                placeholder="Institution (optional)"
                value={m.institution}
                onChange={e => updateMember(idx, "institution", e.target.value)}
                className="w-full text-sm border border-[var(--border-default)] rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
              />
            </div>
          ))}
          <button
            onClick={addCommitteeMember}
            className="flex items-center gap-1.5 text-sm text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)] font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Committee Member
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <div>
          {step > 0 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-4 py-2 border border-[var(--border-default)] rounded"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          ) : onCancel ? (
            <button onClick={onCancel} className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] px-4 py-2">
              Cancel
            </button>
          ) : null}
        </div>
        <div>
          {step < STEPS.length - 1 ? (
            <button
              disabled={!canProceed}
              onClick={() => {
                if (step === 1 && chapters.length === 0) initChapters(degreeType);
                setStep(s => s + 1);
              }}
              className="flex items-center gap-1.5 text-sm bg-[var(--accent-blue)] text-white px-5 py-2 rounded hover:bg-[var(--accent-blue-hover)] disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              disabled={saving}
              onClick={handleCreate}
              className="flex items-center gap-2 text-sm bg-[var(--accent-blue)] text-white px-5 py-2 rounded hover:bg-[var(--accent-blue-hover)] disabled:opacity-50"
            >
              <GraduationCap className="h-4 w-4" />
              {saving ? "Creating..." : "Create Thesis Project"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

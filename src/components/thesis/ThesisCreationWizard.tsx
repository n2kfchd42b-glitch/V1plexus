"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, GripVertical, Trash2, Plus, GraduationCap } from "lucide-react";
import { DegreeType, DEGREE_LABELS, DEFAULT_CHAPTERS_BY_DEGREE } from "@/lib/types/thesis";

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
    setSaving(true);
    // TODO:
    // 1. createClient() and insert project with title, description
    // 2. Insert thesis_metadata with degree info
    // 3. Insert thesis_chapters entries
    // 4. Insert thesis_committees entries (if any)
    // 5. Create documents for each chapter (doc_type = 'thesis_chapter')
    await new Promise(r => setTimeout(r, 1000));
    setSaving(false);
    // router.push(`/projects/${newProjectId}/chapters`);
    router.push("/projects");
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
              i < step ? "bg-blue-600 border-blue-600 text-white" :
              i === step ? "border-blue-600 text-blue-600" :
              "border-gray-200 text-gray-400"
            }`}>
              {i < step ? "✓" : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${i < step ? "bg-blue-600" : "bg-gray-100"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">{STEPS[step]}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {["Enter basic project information", "Configure thesis-specific details", "Set up chapter structure", "Add committee members (optional)"][step]}
        </p>
      </div>

      {/* Step 0: Basic Info */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Thesis / Dissertation Title *</label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Malaria Prevalence in Northern Ghana 2020–2024"
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief description of the research..."
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      )}

      {/* Step 1: Thesis Details */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Degree Type *</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(DEGREE_LABELS) as [DegreeType, string][]).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleDegreeChange(val)}
                  className={`py-2 text-sm font-medium rounded border transition-colors ${
                    degreeType === val
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Program / Specialization *</label>
            <select
              value={program}
              onChange={e => setProgram(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Enrollment Date</label>
              <input
                type="date"
                value={enrollmentDate}
                onChange={e => setEnrollmentDate(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Expected Completion</label>
              <input
                type="date"
                value={expectedCompletion}
                onChange={e => setExpectedCompletion(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Chapters */}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
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
                <div className="cursor-grab text-gray-300 hover:text-gray-500">
                  <GripVertical className="h-4 w-4" />
                </div>
                <span className="text-xs text-gray-400 w-6 shrink-0">{idx + 1}.</span>
                <input
                  type="text"
                  value={ch.title}
                  onChange={e => updateChapter(idx, e.target.value)}
                  placeholder={`Chapter ${idx + 1} title...`}
                  className="flex-1 text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => removeChapter(idx)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addChapter}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mt-1"
          >
            <Plus className="h-4 w-4" />
            Add Chapter
          </button>
        </div>
      )}

      {/* Step 3: Committee */}
      {step === 3 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Optionally add committee members now. You can also do this later from the Committee tab.
          </p>
          {committeeMembers.map((m, idx) => (
            <div key={idx} className="rounded-lg border border-gray-200 p-3 space-y-2 relative">
              <button
                onClick={() => removeMember(idx)}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Full name"
                  value={m.name}
                  onChange={e => updateMember(idx, "name", e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <select
                  value={m.role}
                  onChange={e => updateMember(idx, "role", e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Institution (optional)"
                value={m.institution}
                onChange={e => updateMember(idx, "institution", e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ))}
          <button
            onClick={addCommitteeMember}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
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
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-4 py-2 border border-gray-300 rounded"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          ) : onCancel ? (
            <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
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
              className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              disabled={saving}
              onClick={handleCreate}
              className="flex items-center gap-2 text-sm bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
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

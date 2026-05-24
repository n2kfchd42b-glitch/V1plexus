"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, MapPin, Clock, Video } from "lucide-react";
import { toast } from "sonner";
import {
  ThesisDefense, ThesisChapter, ThesisCommittee, ThesisMetadata, DefenseType
} from "@/lib/types/thesis";
import { createClient } from "@/lib/supabase/client";
import { DefenseChecklist } from "./DefenseChecklist";
import { DefenseOutcomeForm } from "./DefenseOutcomeForm";

interface DefenseManagerProps {
  projectId: string;
  metadata: ThesisMetadata | null;
  defense: ThesisDefense | null;
  chapters: ThesisChapter[];
  committee: ThesisCommittee[];
  canEdit?: boolean;
}

export function DefenseManager({
  projectId,
  defense: initialDefense,
  chapters,
  committee,
  canEdit = false,
}: DefenseManagerProps) {
  const router = useRouter();
  const [defense, setDefense] = useState<ThesisDefense | null>(initialDefense);
  const [defenseType, setDefenseType] = useState<DefenseType>(defense?.defense_type ?? "final");
  const [date, setDate] = useState(defense?.scheduled_date ?? "");
  const [time, setTime] = useState(defense?.scheduled_time ?? "");
  const [location, setLocation] = useState(defense?.location ?? "");
  const [meetingLink, setMeetingLink] = useState(defense?.meeting_link ?? "");
  const [section, setSection] = useState<"checklist" | "schedule" | "outcome">("checklist");
  const [saving, setSaving] = useState(false);
  const [marking, setMarking] = useState(false);

  const hasScheduled = !!defense?.scheduled_date;

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || saving) return;
    if (!date) { toast.error("A date is required"); return; }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      project_id:     projectId,
      defense_type:   defenseType,
      scheduled_date: date,
      scheduled_time: time || null,
      location:       location || null,
      meeting_link:   meetingLink || null,
      updated_at:     new Date().toISOString(),
    };
    const { data, error } = defense
      ? await supabase.from("thesis_defenses").update(payload).eq("id", defense.id).select().single()
      : await supabase.from("thesis_defenses").insert(payload).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setDefense(data as ThesisDefense);
    toast.success(hasScheduled ? "Schedule updated" : "Defense scheduled");
    router.refresh();
  }

  async function setMarker(field: "format_check_completed_at" | "final_submission_at", value: string | null) {
    if (!canEdit || marking) return;
    setMarking(true);
    const supabase = createClient();
    // Need a defense row to attach the marker to; create a minimal one if missing
    if (!defense) {
      const { data, error } = await supabase
        .from("thesis_defenses")
        .insert({ project_id: projectId, defense_type: "final", [field]: value })
        .select().single();
      setMarking(false);
      if (error) { toast.error(error.message); return; }
      setDefense(data as ThesisDefense);
      router.refresh();
      return;
    }
    const { data, error } = await supabase
      .from("thesis_defenses")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", defense.id)
      .select().single();
    setMarking(false);
    if (error) { toast.error(error.message); return; }
    setDefense(data as ThesisDefense);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Section tabs */}
      <div className="flex gap-1 bg-[var(--bg-surface-active)] rounded-lg p-1 w-fit">
        {([
          ["checklist", "Pre-Defense Checklist"],
          ["schedule", "Schedule Defense"],
          ["outcome", "Record Outcome"],
        ] as [typeof section, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`text-xs font-medium px-3 py-1.5 rounded transition-colors ${
              section === key
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Checklist */}
      {section === "checklist" && (
        <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Pre-Defense Checklist</h3>
          <DefenseChecklist
            chapters={chapters}
            committee={committee}
            defense={defense}
            canEdit={canEdit}
            busy={marking}
            onMarkFormatCheck={()   => setMarker("format_check_completed_at", new Date().toISOString())}
            onUnmarkFormatCheck={() => setMarker("format_check_completed_at", null)}
            onMarkSubmission={()    => setMarker("final_submission_at",       new Date().toISOString())}
            onUnmarkSubmission={()  => setMarker("final_submission_at",       null)}
          />
        </div>
      )}

      {/* Schedule */}
      {section === "schedule" && (
        <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] p-5 space-y-4">
          <h3 className="font-semibold text-[var(--text-primary)]">Schedule Defense</h3>
          {defense && hasScheduled && (
            <div className="mb-4 p-3 bg-[var(--status-info-bg)] border border-[var(--border-status-info)] rounded-lg text-sm text-[var(--status-info-text)]">
              <p className="font-medium">Currently Scheduled</p>
              <p className="text-xs mt-1">
                {defense.defense_type === "final" ? "Final" : "Proposal"} Defense ·{" "}
                {defense.scheduled_date} {defense.scheduled_time && `at ${defense.scheduled_time}`}
                {defense.location && ` · ${defense.location}`}
              </p>
            </div>
          )}
          <form onSubmit={handleSchedule} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Defense Type</label>
              <select
                value={defenseType}
                onChange={e => setDefenseType(e.target.value as DefenseType)}
                disabled={!canEdit}
                className="w-full text-sm border border-[var(--border-default)] rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] disabled:opacity-60"
              >
                <option value="proposal">Proposal Defense</option>
                <option value="final">Final Defense</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  <Calendar className="inline h-3 w-3 mr-1" />Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  disabled={!canEdit}
                  className="w-full text-sm border border-[var(--border-default)] rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  <Clock className="inline h-3 w-3 mr-1" />Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  disabled={!canEdit}
                  className="w-full text-sm border border-[var(--border-default)] rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                <MapPin className="inline h-3 w-3 mr-1" />Location
              </label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Room 204, SPH Building"
                disabled={!canEdit}
                className="w-full text-sm border border-[var(--border-default)] rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                <Video className="inline h-3 w-3 mr-1" />Virtual Meeting Link
              </label>
              <input
                type="url"
                value={meetingLink}
                onChange={e => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/..."
                disabled={!canEdit}
                className="w-full text-sm border border-[var(--border-default)] rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] disabled:opacity-60"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={!canEdit || saving}
                className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-white rounded hover:bg-[var(--accent-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving…" : hasScheduled ? "Update Schedule" : "Schedule Defense"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Outcome */}
      {section === "outcome" && (
        <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Record Defense Outcome</h3>
          {!hasScheduled ? (
            <p className="text-sm text-[var(--text-tertiary)]">Schedule the defense first before recording an outcome.</p>
          ) : defense ? (
            <DefenseOutcomeForm
              defense={defense}
              canEdit={canEdit}
              onSaved={updated => { setDefense(updated); router.refresh(); }}
            />
          ) : (
            <p className="text-sm text-[var(--text-tertiary)]">No defense scheduled yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

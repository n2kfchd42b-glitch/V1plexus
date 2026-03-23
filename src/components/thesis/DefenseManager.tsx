"use client";

import { useState } from "react";
import { Calendar, MapPin, Link2, Clock, Video } from "lucide-react";
import {
  ThesisDefense, ThesisChapter, ThesisCommittee, ThesisMetadata, DefenseType
} from "@/lib/types/thesis";
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
  metadata,
  defense: initialDefense,
  chapters,
  committee,
  canEdit,
}: DefenseManagerProps) {
  const [defense, setDefense] = useState(initialDefense);
  const [defenseType, setDefenseType] = useState<DefenseType>("final");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<"checklist" | "schedule" | "outcome">("checklist");

  const hasScheduled = !!(defense?.scheduled_date);
  const hasOutcome = !!(defense?.outcome);

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    // TODO: upsert thesis_defenses via Supabase
    await new Promise(r => setTimeout(r, 500));
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {/* Section tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
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
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Checklist */}
      {section === "checklist" && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Pre-Defense Checklist</h3>
          <DefenseChecklist
            chapters={chapters}
            committee={committee}
            metadata={metadata}
            hasScheduledDefense={hasScheduled}
          />
        </div>
      )}

      {/* Schedule */}
      {section === "schedule" && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Schedule Defense</h3>
          {defense && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Defense Type</label>
              <select
                value={defenseType}
                onChange={e => setDefenseType(e.target.value as DefenseType)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="proposal">Proposal Defense</option>
                <option value="final">Final Defense</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <Calendar className="inline h-3 w-3 mr-1" />Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <Clock className="inline h-3 w-3 mr-1" />Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <MapPin className="inline h-3 w-3 mr-1" />Location
              </label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Room 204, SPH Building"
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <Video className="inline h-3 w-3 mr-1" />Virtual Meeting Link
              </label>
              <input
                type="url"
                value={meetingLink}
                onChange={e => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={saving || !date}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Scheduling..." : hasScheduled ? "Update Schedule" : "Schedule Defense"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Outcome */}
      {section === "outcome" && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Record Defense Outcome</h3>
          {!hasScheduled ? (
            <p className="text-sm text-gray-500">Schedule the defense first before recording an outcome.</p>
          ) : defense ? (
            <DefenseOutcomeForm
              defense={defense}
              onSaved={() => {
                // TODO: refresh defense data
              }}
            />
          ) : (
            <p className="text-sm text-gray-500">No defense scheduled yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

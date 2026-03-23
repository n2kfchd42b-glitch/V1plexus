"use client";

import { useState } from "react";
import { X, Bell, Users } from "lucide-react";
import { CoordinatorThesisRow } from "@/lib/types/thesis";

interface BulkReminderModalProps {
  students: CoordinatorThesisRow[];
  onClose: () => void;
}

const REMINDER_TYPES = [
  { value: "chapter_overdue",    label: "Chapter Overdue",        description: "Remind students with overdue chapters" },
  { value: "submission_due",     label: "Upcoming Deadline",       description: "Remind students with chapters due in 2 weeks" },
  { value: "committee_pending",  label: "Committee Confirmation",  description: "Prompt supervisors for pending committee confirmations" },
  { value: "progress_review",    label: "Progress Review",         description: "Schedule a general progress check-in" },
];

export function BulkReminderModal({ students, onClose }: BulkReminderModalProps) {
  const [reminderType, setReminderType] = useState("chapter_overdue");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(students.map(s => s.project_id)));
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  function toggleStudent(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map(s => s.project_id)));
    }
  }

  async function handleSend() {
    setSending(true);
    // TODO: trigger notification/email API for selected students
    await new Promise(r => setTimeout(r, 800));
    setSending(false);
    setSent(true);
    setTimeout(onClose, 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-500" />
            Send Bulk Reminder
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Reminder type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Reminder Type</label>
            <div className="space-y-2">
              {REMINDER_TYPES.map(rt => (
                <label
                  key={rt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    reminderType === rt.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="reminderType"
                    value={rt.value}
                    checked={reminderType === rt.value}
                    onChange={() => setReminderType(rt.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{rt.label}</p>
                    <p className="text-xs text-gray-500">{rt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                Recipients ({selectedIds.size} selected)
              </label>
              <button onClick={toggleAll} className="text-xs text-blue-600 hover:text-blue-700">
                {selectedIds.size === students.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-36 overflow-y-auto">
              {students.map(s => (
                <label
                  key={s.project_id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.project_id)}
                    onChange={() => toggleStudent(s.project_id)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">{s.student_name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{s.degree_type.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom message */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Additional Message (optional)</label>
            <textarea
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              rows={2}
              placeholder="Add a personal note to accompany the reminder..."
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || selectedIds.size === 0 || sent}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {sent ? "Sent!" : sending ? "Sending..." : `Send to ${selectedIds.size} student${selectedIds.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

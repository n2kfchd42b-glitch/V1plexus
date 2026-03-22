"use client";

import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { EthicsApplication } from "@/lib/types/database";

type EthicsStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "conditionally_approved"
  | "rejected";

const STATUSES: { value: EthicsStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "conditionally_approved", label: "Conditionally Approved" },
  { value: "rejected", label: "Rejected" },
];

export function EthicsApplicationForm({
  projectId,
  existing,
  onSaved,
  onClose,
}: {
  projectId: string;
  existing?: EthicsApplication | null;
  onSaved: (application: EthicsApplication) => void;
  onClose: () => void;
}) {
  const [boardName, setBoardName] = useState(existing?.board_name ?? "");
  const [applicationRef, setApplicationRef] = useState(
    existing?.application_ref ?? ""
  );
  const [status, setStatus] = useState<EthicsStatus>(
    (existing?.status as EthicsStatus) ?? "draft"
  );
  const [submittedAt, setSubmittedAt] = useState(
    existing?.submitted_at ? existing.submitted_at.split("T")[0] : ""
  );
  const [approvedAt, setApprovedAt] = useState(
    existing?.approved_at ? existing.approved_at.split("T")[0] : ""
  );
  const [expiresAt, setExpiresAt] = useState(
    existing?.expires_at ? existing.expires_at.split("T")[0] : ""
  );
  const [conditions, setConditions] = useState(existing?.conditions ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      project_id: projectId,
      board_name: boardName || null,
      application_ref: applicationRef || null,
      status,
      submitted_at: submittedAt ? new Date(submittedAt).toISOString() : null,
      approved_at: approvedAt ? new Date(approvedAt).toISOString() : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      conditions: conditions || null,
      notes: notes || null,
      created_by: user.id,
    };

    const { data, error } = existing
      ? await supabase
          .from("ethics_applications")
          .update(payload)
          .eq("id", existing.id)
          .select()
          .single()
      : await supabase
          .from("ethics_applications")
          .insert(payload)
          .select()
          .single();

    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data) {
      onSaved(data);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">
            {existing ? "Edit Application" : "New Ethics Application"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ethics board name
            </label>
            <input
              type="text"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. University of Ghana IRB"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Application reference number
            </label>
            <input
              type="text"
              value={applicationRef}
              onChange={(e) => setApplicationRef(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. IRB-2026-0234"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <div className="relative">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EthicsStatus)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date submitted
              </label>
              <input
                type="date"
                value={submittedAt}
                onChange={(e) => setSubmittedAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date approved
              </label>
              <input
                type="date"
                value={approvedAt}
                onChange={(e) => setApprovedAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiry date
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {(status === "conditionally_approved") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Conditions
              </label>
              <textarea
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the conditions for approval…"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Any additional notes…"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Saving…" : existing ? "Save changes" : "Create application"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

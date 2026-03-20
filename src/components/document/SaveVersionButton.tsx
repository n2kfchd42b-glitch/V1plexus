"use client";

import { useState } from "react";
import { BookmarkPlus } from "lucide-react";

export function SaveVersionButton({
  onSave,
  disabled,
}: {
  onSave: (summary: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(summary);
    setSaving(false);
    setSummary("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-40"
      >
        <BookmarkPlus className="h-4 w-4" />
        Save version
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Version summary (optional)"
        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setOpen(false);
        }}
        autoFocus
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        Cancel
      </button>
    </div>
  );
}

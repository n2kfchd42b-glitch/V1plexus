"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ThesisDefense, DefenseOutcome } from "@/lib/types/thesis";
import { createClient } from "@/lib/supabase/client";

interface DefenseOutcomeFormProps {
  defense: ThesisDefense;
  canEdit: boolean;
  onSaved: (updated: ThesisDefense) => void;
}

const OUTCOMES: { value: DefenseOutcome; label: string; description: string }[] = [
  { value: "pass",                  label: "Pass",                   description: "Thesis accepted as submitted" },
  { value: "pass_with_corrections", label: "Pass with Corrections",  description: "Pass conditional on minor corrections" },
  { value: "revise_resubmit",       label: "Revise & Resubmit",      description: "Major revisions required before re-examination" },
  { value: "fail",                  label: "Fail",                   description: "Thesis not accepted" },
];

export function DefenseOutcomeForm({ defense, canEdit, onSaved }: DefenseOutcomeFormProps) {
  const [outcome, setOutcome]   = useState<DefenseOutcome | "">(defense.outcome ?? "");
  const [deadline, setDeadline] = useState(defense.corrections_deadline ?? "");
  const [notes, setNotes]       = useState(defense.notes ?? "");
  const [saving, setSaving]     = useState(false);

  const needsDeadline = outcome === "pass_with_corrections" || outcome === "revise_resubmit";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || saving) return;
    if (!outcome) { toast.error("Pick an outcome"); return; }
    if (needsDeadline && !deadline) { toast.error("A corrections deadline is required"); return; }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("thesis_defenses")
      .update({
        outcome,
        corrections_deadline: needsDeadline ? deadline : null,
        notes:                notes || null,
        updated_at:           new Date().toISOString(),
      })
      .eq("id", defense.id)
      .select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Outcome recorded");
    onSaved(data as ThesisDefense);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Outcome */}
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Defense Outcome *</label>
        <div className="space-y-2">
          {OUTCOMES.map(o => (
            <label
              key={o.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                outcome === o.value
                  ? "border-[var(--accent-blue)] bg-[var(--accent-blue-subtle)]"
                  : "border-[var(--border-default)] hover:border-[var(--border-strong)]"
              } ${!canEdit ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <input
                type="radio"
                name="outcome"
                value={o.value}
                checked={outcome === o.value}
                onChange={() => setOutcome(o.value)}
                disabled={!canEdit}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{o.label}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{o.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {needsDeadline && (
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Corrections Deadline *
          </label>
          <input
            type="date"
            required
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            disabled={!canEdit}
            className="w-full text-sm border border-[var(--border-default)] rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] disabled:opacity-60"
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Examiner Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Record examiner feedback, observations, or requirements..."
          disabled={!canEdit}
          className="w-full text-sm border border-[var(--border-default)] rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] resize-none disabled:opacity-60"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canEdit || saving}
          className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-white rounded hover:bg-[var(--accent-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Record Outcome"}
        </button>
      </div>
    </form>
  );
}

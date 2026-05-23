"use client";

import { useState } from "react";
import { ThesisDefense, DefenseOutcome } from "@/lib/types/thesis";
import { UnfinishedFeatureBanner } from "./UnfinishedFeatureBanner";

interface DefenseOutcomeFormProps {
  defense: ThesisDefense;
}

const OUTCOMES: { value: DefenseOutcome; label: string; description: string }[] = [
  { value: "pass",                  label: "Pass",                   description: "Thesis accepted as submitted" },
  { value: "pass_with_corrections", label: "Pass with Corrections",  description: "Pass conditional on minor corrections" },
  { value: "revise_resubmit",       label: "Revise & Resubmit",      description: "Major revisions required before re-examination" },
  { value: "fail",                  label: "Fail",                   description: "Thesis not accepted" },
];

export function DefenseOutcomeForm({ defense }: DefenseOutcomeFormProps) {
  const [outcome, setOutcome] = useState<DefenseOutcome | "">(defense.outcome ?? "");
  const [deadline, setDeadline] = useState(defense.corrections_deadline ?? "");
  const [notes, setNotes] = useState(defense.notes ?? "");

  const needsDeadline = outcome === "pass_with_corrections" || outcome === "revise_resubmit";

  return (
    <form onSubmit={e => e.preventDefault()} className="space-y-4">
      <UnfinishedFeatureBanner feature="Defense outcome recording" />
      {/* Outcome */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Defense Outcome *</label>
        <div className="space-y-2">
          {OUTCOMES.map(o => (
            <label
              key={o.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                outcome === o.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="outcome"
                value={o.value}
                checked={outcome === o.value}
                onChange={() => setOutcome(o.value)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{o.label}</p>
                <p className="text-xs text-gray-500">{o.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {needsDeadline && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Corrections Deadline *
          </label>
          <input
            type="date"
            required
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Examiner Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Record examiner feedback, observations, or requirements..."
          className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled
          title="Backend not yet connected"
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded opacity-50 cursor-not-allowed"
        >
          Record Outcome
        </button>
      </div>
    </form>
  );
}

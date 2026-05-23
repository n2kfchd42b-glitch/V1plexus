"use client";

import { useState } from "react";
import { Play, FileCheck } from "lucide-react";
import { FormatRule } from "@/lib/types/thesis";
import { UnfinishedFeatureBanner } from "./UnfinishedFeatureBanner";

interface FormatCheckerProps {
  projectId: string;
  formatRules: FormatRule[];
}

export function FormatChecker({ formatRules }: FormatCheckerProps) {
  const [selectedRule, setSelectedRule] = useState<string>(formatRules[0]?.id ?? "");

  // Format-check engine + compliance-report export not yet implemented.
  // The Run-Check button is disabled and the previous mock results have
  // been removed so reviewers can't mistake them for real output.

  return (
    <div className="space-y-5">
      <UnfinishedFeatureBanner feature="Document format checking" />
      {/* Header controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-700 mb-1">Format Template</label>
            {formatRules.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                No format rules configured. Ask your institution administrator to set up format rules.
              </p>
            ) : (
              <select
                value={selectedRule}
                onChange={e => setSelectedRule(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {formatRules.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              disabled
              title="Backend not yet connected"
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded opacity-50 cursor-not-allowed"
            >
              <Play className="h-4 w-4" />
              Run Check
            </button>
          </div>
        </div>
      </div>

      <div className="text-center py-16 text-gray-400">
        <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Format checking will be available once the institutional rules engine is wired up.</p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Play, Download, FileCheck } from "lucide-react";
import { FormatRule, FormatViolation } from "@/lib/types/thesis";
import { FormatViolationList } from "./FormatViolationList";

interface FormatCheckerProps {
  projectId: string;
  formatRules: FormatRule[];
}

// Placeholder violations for UI demonstration
const MOCK_VIOLATIONS: FormatViolation[] = [
  { id: "1", severity: "error", location: "Ch 2, heading", field: "font-size", actual: "14pt", expected: "16pt bold", auto_fixable: true },
  { id: "2", severity: "error", location: "Ch 3, margins", field: "left-margin", actual: "2.0cm", expected: "2.54cm", auto_fixable: true },
  { id: "3", severity: "warn",  location: "Ch 1, line spacing", field: "line-height", actual: "1.5", expected: "2.0", auto_fixable: true },
  { id: "4", severity: "warn",  location: "References", field: "citation-style", actual: "APA 6th", expected: "APA 7th", auto_fixable: false },
  { id: "5", severity: "info",  location: "Front matter", field: "page-numbers", actual: "Arabic from page 1", expected: "Roman numerals for front matter", auto_fixable: false },
];

export function FormatChecker({ formatRules }: FormatCheckerProps) {
  const [selectedRule, setSelectedRule] = useState<string>(formatRules[0]?.id ?? "");
  const [violations, setViolations] = useState<FormatViolation[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [running, setRunning] = useState(false);
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());

  async function handleRunCheck() {
    setRunning(true);
    // TODO: call actual format check API
    await new Promise(r => setTimeout(r, 1200));
    setViolations(MOCK_VIOLATIONS);
    setHasRun(true);
    setRunning(false);
  }

  function handleAutoFix(id: string) {
    setFixedIds(prev => new Set([...prev, id]));
    setViolations(prev => prev.filter(v => v.id !== id));
  }

  function handleAutoFixAll() {
    const autoFixable = violations.filter(v => v.auto_fixable).map(v => v.id);
    setFixedIds(prev => new Set([...prev, ...autoFixable]));
    setViolations(prev => prev.filter(v => !v.auto_fixable));
  }

  function handleExportReport() {
    // TODO: generate and download compliance report PDF
    const content = `Format Compliance Report\n\nIssues found: ${violations.length}\nAuto-fixed: ${fixedIds.size}\n`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "format-compliance-report.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
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
              onClick={handleRunCheck}
              disabled={running || !selectedRule}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {running ? "Checking..." : "Run Check"}
            </button>
            {hasRun && (
              <button
                onClick={handleExportReport}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Export Report
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {running && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-500">Checking document format against institutional rules...</p>
        </div>
      )}

      {hasRun && !running && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileCheck className="h-5 w-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Results</h3>
            {fixedIds.size > 0 && (
              <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                {fixedIds.size} auto-fixed
              </span>
            )}
          </div>
          <FormatViolationList
            violations={violations}
            onAutoFix={handleAutoFix}
            onAutoFixAll={handleAutoFixAll}
          />
        </div>
      )}

      {!hasRun && !running && (
        <div className="text-center py-16 text-gray-400">
          <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a format template and run the check to see results.</p>
        </div>
      )}
    </div>
  );
}

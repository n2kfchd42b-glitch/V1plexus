"use client";

import { useMemo } from "react";
import { ThesisChapter, ThesisMetadata, ThesisDefense, EarlyWarning, GanttEntry } from "@/lib/types/thesis";
import { GanttTimeline } from "./GanttTimeline";
import { EarlyWarningPanel } from "./EarlyWarningPanel";

interface ProgressDashboardProps {
  metadata: ThesisMetadata | null;
  chapters: ThesisChapter[];
  defense: ThesisDefense | null;
}

function computeStats(chapters: ThesisChapter[], metadata: ThesisMetadata | null) {
  const total = chapters.length;
  const approved = chapters.filter(c => c.status === "approved" || c.status === "locked").length;
  const inProgress = chapters.filter(c => ["drafting", "submitted_for_review", "revision_requested"].includes(c.status)).length;
  const overdue = chapters.filter(c =>
    c.target_date &&
    new Date(c.target_date) < new Date() &&
    c.status !== "approved" &&
    c.status !== "locked"
  ).length;

  const percent = total > 0 ? Math.round((approved / total) * 100) : 0;

  // Estimate completion from pace
  let monthsBehind = 0;
  let estimatedCompletion: string | null = null;
  if (metadata?.expected_completion) {
    const expected = new Date(metadata.expected_completion);
    const now = new Date();
    if (overdue > 0) {
      const avgDelay = chapters
        .filter(c => c.target_date && new Date(c.target_date) < now && c.status !== "approved")
        .reduce((sum, c) => {
          const diff = (now.getTime() - new Date(c.target_date!).getTime()) / (1000 * 60 * 60 * 24 * 30);
          return sum + diff;
        }, 0) / Math.max(overdue, 1);
      monthsBehind = Math.round(avgDelay);
      const est = new Date(expected);
      est.setMonth(est.getMonth() + monthsBehind);
      estimatedCompletion = est.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    }
  }

  return { total, approved, inProgress, overdue, percent, monthsBehind, estimatedCompletion };
}

function buildWarnings(chapters: ThesisChapter[], stats: ReturnType<typeof computeStats>, metadata: ThesisMetadata | null): EarlyWarning[] {
  const warnings: EarlyWarning[] = [];
  const now = new Date();

  chapters.forEach(c => {
    if (c.target_date && new Date(c.target_date) < now && c.status !== "approved" && c.status !== "locked") {
      const days = Math.round((now.getTime() - new Date(c.target_date).getTime()) / (1000 * 60 * 60 * 24));
      warnings.push({
        type: days > 30 ? "overdue" : "at_risk",
        chapter_id: c.id,
        chapter_title: c.title,
        message: `Chapter ${c.chapter_number} (${c.title}) is ${days} day${days !== 1 ? "s" : ""} behind target (target: ${new Date(c.target_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}).`,
        days_behind: days,
      });
    }
  });

  if (stats.monthsBehind > 0 && metadata?.expected_completion) {
    const expected = new Date(metadata.expected_completion).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    warnings.push({
      type: "pace",
      message: `At current pace, estimated completion is ${stats.estimatedCompletion} (${stats.monthsBehind} month${stats.monthsBehind !== 1 ? "s" : ""} behind original plan of ${expected}).`,
    });
  }

  // Info for on-track chapters
  const onTrack = chapters.filter(c =>
    c.target_date &&
    new Date(c.target_date) > now &&
    (c.status === "drafting" || c.status === "submitted_for_review")
  );
  onTrack.forEach(c => {
    warnings.push({
      type: "info",
      chapter_id: c.id,
      chapter_title: c.title,
      message: `Chapter ${c.chapter_number} (${c.title}) is on track (target: ${new Date(c.target_date!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}).`,
    });
  });

  return warnings;
}

function buildGanttEntries(chapters: ThesisChapter[], defense: ThesisDefense | null, metadata: ThesisMetadata | null): GanttEntry[] {
  const entries: GanttEntry[] = chapters.map(c => ({
    id: c.id,
    label: `Ch ${c.chapter_number}: ${c.title}`,
    start_date: metadata?.enrollment_date ?? null,
    target_date: c.target_date,
    actual_end: c.approved_at ?? null,
    status: c.status,
  }));

  if (defense?.scheduled_date) {
    entries.push({
      id: defense.id,
      label: defense.defense_type === "final" ? "Final Defense" : "Proposal Defense",
      start_date: defense.scheduled_date,
      target_date: defense.scheduled_date,
      actual_end: defense.outcome ? defense.scheduled_date : null,
      status: "defense",
    });
  }

  return entries;
}

export function ProgressDashboard({ metadata, chapters, defense }: ProgressDashboardProps) {
  const stats = useMemo(() => computeStats(chapters, metadata), [chapters, metadata]);
  const warnings = useMemo(() => buildWarnings(chapters, stats, metadata), [chapters, stats, metadata]);
  const ganttEntries = useMemo(() => buildGanttEntries(chapters, defense, metadata), [chapters, defense, metadata]);

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Overall Progress</h3>
          <span className="text-2xl font-bold text-blue-600">{stats.percent}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${stats.percent}%` }}
          />
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
          <span>{stats.approved} of {stats.total} chapters approved</span>
          {stats.inProgress > 0 && <span>{stats.inProgress} in progress</span>}
          {stats.overdue > 0 && <span className="text-red-600">{stats.overdue} overdue</span>}
        </div>

        {metadata && (
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100 text-xs">
            {metadata.enrollment_date && (
              <div>
                <p className="text-gray-400 uppercase tracking-wide font-medium">Enrolled</p>
                <p className="text-gray-700 mt-0.5">{new Date(metadata.enrollment_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
            )}
            {metadata.expected_completion && (
              <div>
                <p className="text-gray-400 uppercase tracking-wide font-medium">Expected Completion</p>
                <p className="text-gray-700 mt-0.5">{new Date(metadata.expected_completion).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gantt Timeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Timeline</h3>
        <GanttTimeline
          entries={ganttEntries}
          startDate={metadata?.enrollment_date ? new Date(metadata.enrollment_date) : undefined}
          endDate={metadata?.expected_completion ? new Date(metadata.expected_completion) : undefined}
        />
      </div>

      {/* Early warnings */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Early Warnings</h3>
        <EarlyWarningPanel warnings={warnings} />
      </div>
    </div>
  );
}

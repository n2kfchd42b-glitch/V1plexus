"use client";

import { CheckCircle, Circle, AlertCircle } from "lucide-react";
import { ThesisChapter, ThesisCommittee, ThesisDefense } from "@/lib/types/thesis";
import { cn } from "@/lib/utils";

interface CheckItem {
  label: string;
  checked: boolean;
  autoChecked: boolean;
  warning?: string;
  onMarkDone?: () => void;
  onUnmark?: () => void;
  busy?: boolean;
}

interface DefenseChecklistProps {
  chapters: ThesisChapter[];
  committee: ThesisCommittee[];
  defense: ThesisDefense | null;
  canEdit: boolean;
  busy: boolean;
  onMarkFormatCheck: () => void;
  onUnmarkFormatCheck: () => void;
  onMarkSubmission: () => void;
  onUnmarkSubmission: () => void;
}

export function DefenseChecklist({
  chapters,
  committee,
  defense,
  canEdit,
  busy,
  onMarkFormatCheck,
  onUnmarkFormatCheck,
  onMarkSubmission,
  onUnmarkSubmission,
}: DefenseChecklistProps) {
  const allChaptersApproved = chapters.length > 0 && chapters.every(
    c => c.status === "approved" || c.status === "locked"
  );

  const confirmedCount = committee.filter(m => m.status === "confirmed").length;
  const totalCount = committee.filter(m => m.status !== "removed" && m.status !== "declined").length;
  const committeeConfirmed = confirmedCount > 0 && confirmedCount === totalCount;

  const hasSchedule = !!defense?.scheduled_date;
  const formatChecked = !!defense?.format_check_completed_at;
  const submitted     = !!defense?.final_submission_at;

  const items: CheckItem[] = [
    {
      label: "All chapters approved by supervisor",
      checked: allChaptersApproved,
      autoChecked: true,
      warning: !allChaptersApproved && chapters.length > 0
        ? `${chapters.filter(c => c.status !== "approved" && c.status !== "locked").length} chapter(s) still pending approval`
        : undefined,
    },
    {
      label: `Committee fully confirmed (${confirmedCount}/${totalCount} confirmed)`,
      checked: committeeConfirmed,
      autoChecked: true,
      warning: !committeeConfirmed && totalCount > 0
        ? `${totalCount - confirmedCount} member(s) have not confirmed`
        : undefined,
    },
    {
      label: "Format compliance check passed",
      checked: formatChecked,
      autoChecked: false,
      onMarkDone:  canEdit ? onMarkFormatCheck   : undefined,
      onUnmark:    canEdit ? onUnmarkFormatCheck : undefined,
      busy,
    },
    {
      label: "Final document submitted to graduate school",
      checked: submitted,
      autoChecked: false,
      onMarkDone:  canEdit ? onMarkSubmission   : undefined,
      onUnmark:    canEdit ? onUnmarkSubmission : undefined,
      busy,
    },
    {
      label: "Defense date scheduled",
      checked: hasSchedule,
      autoChecked: true,
    },
  ];

  const passedCount = items.filter(i => i.checked).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-[var(--text-tertiary)]">{passedCount} of {items.length} requirements met</span>
        <div className="h-1.5 w-24 bg-[var(--bg-surface-active)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--status-success)] rounded-full transition-all"
            style={{ width: `${(passedCount / items.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            {item.checked ? (
              <CheckCircle className="h-4 w-4 text-[var(--status-success)] mt-0.5 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-[var(--border-strong)] mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <span className={cn(
                "text-sm",
                item.checked ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)]"
              )}>
                {item.label}
              </span>
              {!item.autoChecked && (
                item.checked && item.onUnmark ? (
                  <button
                    type="button"
                    onClick={item.onUnmark}
                    disabled={item.busy}
                    className="ml-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    Unmark
                  </button>
                ) : !item.checked && item.onMarkDone ? (
                  <button
                    type="button"
                    onClick={item.onMarkDone}
                    disabled={item.busy}
                    className="ml-2 text-xs font-medium text-[var(--accent-blue)] hover:underline disabled:opacity-50"
                  >
                    Mark done
                  </button>
                ) : !item.autoChecked && !item.checked ? (
                  <span className="ml-2 text-xs text-[var(--text-tertiary)] italic">Manual</span>
                ) : null
              )}
              {item.warning && (
                <div className="flex items-center gap-1 mt-0.5 text-xs text-[var(--status-warning-text)]">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {item.warning}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

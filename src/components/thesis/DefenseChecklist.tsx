"use client";

import { CheckCircle, Circle, AlertCircle } from "lucide-react";
import { ThesisChapter, ThesisCommittee, ThesisMetadata } from "@/lib/types/thesis";
import { cn } from "@/lib/utils";

interface CheckItem {
  label: string;
  checked: boolean;
  autoChecked: boolean;
  warning?: string;
}

interface DefenseChecklistProps {
  chapters: ThesisChapter[];
  committee: ThesisCommittee[];
  metadata: ThesisMetadata | null;
  hasFormatCompliance?: boolean;
  hasSubmittedDocument?: boolean;
  hasScheduledDefense?: boolean;
}

export function DefenseChecklist({
  chapters,
  committee,
  metadata,
  hasFormatCompliance = false,
  hasSubmittedDocument = false,
  hasScheduledDefense = false,
}: DefenseChecklistProps) {
  const allChaptersApproved = chapters.length > 0 && chapters.every(
    c => c.status === "approved" || c.status === "locked"
  );

  const confirmedCount = committee.filter(m => m.status === "confirmed").length;
  const totalCount = committee.filter(m => m.status !== "removed" && m.status !== "declined").length;
  const committeeConfirmed = confirmedCount > 0 && confirmedCount === totalCount;

  const ethicsActive = metadata !== null; // Simplified: if metadata exists, assume ethics checked

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
      label: "Ethics approval current",
      checked: ethicsActive,
      autoChecked: true,
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
      checked: hasFormatCompliance,
      autoChecked: false,
    },
    {
      label: "Final document submitted to graduate school",
      checked: hasSubmittedDocument,
      autoChecked: false,
    },
    {
      label: "Defense date scheduled",
      checked: hasScheduledDefense,
      autoChecked: false,
    },
  ];

  const passedCount = items.filter(i => i.checked).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{passedCount} of {items.length} requirements met</span>
        <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${(passedCount / items.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            {item.checked ? (
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-gray-300 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <span className={cn(
                "text-sm",
                item.checked ? "text-gray-700" : "text-gray-500"
              )}>
                {item.label}
              </span>
              {!item.autoChecked && !item.checked && (
                <span className="ml-2 text-xs text-gray-400 italic">Manual</span>
              )}
              {item.warning && (
                <div className="flex items-center gap-1 mt-0.5 text-xs text-amber-600">
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

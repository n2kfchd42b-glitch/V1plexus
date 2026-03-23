"use client";

import Link from "next/link";
import { FileText, Calendar, User, Clock, CheckCircle, AlertCircle, Lock } from "lucide-react";
import { ThesisChapter, CHAPTER_STATUS_CONFIG } from "@/lib/types/thesis";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ChapterCardProps {
  chapter: ThesisChapter;
  projectId: string;
  onSubmitForReview?: (chapterId: string) => void;
  onStartWriting?: (chapterId: string) => void;
  canReview?: boolean;
}

const statusIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  not_started:          Clock,
  drafting:             FileText,
  submitted_for_review: Clock,
  revision_requested:   AlertCircle,
  approved:             CheckCircle,
  locked:               Lock,
};

export function ChapterCard({
  chapter,
  projectId,
  onSubmitForReview,
  onStartWriting,
}: ChapterCardProps) {
  const cfg = CHAPTER_STATUS_CONFIG[chapter.status];
  const StatusIcon = statusIcon[chapter.status] ?? FileText;
  const isOverdue =
    chapter.target_date &&
    new Date(chapter.target_date) < new Date() &&
    chapter.status !== "approved" &&
    chapter.status !== "locked";

  return (
    <div className={cn("rounded-lg border bg-white p-4 transition-shadow hover:shadow-sm", cfg.border)}>
      <div className="flex items-start justify-between gap-3">
        {/* Left: Chapter info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Ch {chapter.chapter_number}
            </span>
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", cfg.bg, cfg.color)}>
              <StatusIcon className="h-3 w-3" />
              {cfg.label}
            </span>
            {isOverdue && (
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                Overdue
              </span>
            )}
          </div>

          <h3 className="font-semibold text-gray-900 text-sm mb-2">{chapter.title}</h3>

          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {chapter.target_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Target: {formatDate(chapter.target_date)}
              </span>
            )}
            {chapter.submitted_at && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Submitted: {formatDate(chapter.submitted_at)}
              </span>
            )}
            {chapter.approved_at && chapter.approver && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Approved by: {chapter.approver.full_name ?? "Supervisor"}
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {chapter.document_id ? (
            <Link
              href={`/projects/${projectId}/documents/${chapter.document_id}`}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-50 transition-colors whitespace-nowrap"
            >
              Open Document
            </Link>
          ) : (
            chapter.status === "not_started" && onStartWriting ? (
              <button
                onClick={() => onStartWriting(chapter.id)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-50 transition-colors whitespace-nowrap"
              >
                Start Writing
              </button>
            ) : null
          )}

          {chapter.status === "drafting" && onSubmitForReview && (
            <button
              onClick={() => onSubmitForReview(chapter.id)}
              className="text-xs font-medium text-purple-600 hover:text-purple-700 px-3 py-1.5 rounded border border-purple-200 hover:bg-purple-50 transition-colors whitespace-nowrap"
            >
              Submit for Review
            </button>
          )}

          {chapter.status === "revision_requested" && (
            <button
              onClick={() => onSubmitForReview && onSubmitForReview(chapter.id)}
              className="text-xs font-medium text-amber-600 hover:text-amber-700 px-3 py-1.5 rounded border border-amber-200 hover:bg-amber-50 transition-colors whitespace-nowrap"
            >
              Resubmit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText, Calendar, User, Clock, CheckCircle, AlertCircle, Lock, History, ChevronDown, MessageCircle } from "lucide-react";
import type { ThesisChapter } from "@/types/database";
import { CHAPTER_STATUS_CONFIG } from "@/lib/types/thesis";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { THESIS_WORKFLOW_V2 } from "@/lib/flags";

interface ChapterHistory {
  submissions: Array<{
    id: string;
    round: number;
    document_version_number: number | null;
    note: string | null;
    submitted_at: string;
    decision: "approved" | "revision_requested" | null;
    feedback: string | null;
    reviewed_at: string | null;
    student: { full_name: string | null } | null;
    reviewer: { full_name: string | null } | null;
  }>;
  versions: Array<{
    id: string;
    version_number: number;
    change_summary: string | null;
    created_at: string;
    author: { full_name: string | null } | null;
  }>;
  comments: Array<{
    id: string;
    review_id: string;
    content: string;
    parent_id: string | null;
    created_at: string;
    author: { full_name: string | null } | null;
  }>;
}

interface ChapterCardProps {
  chapter: ThesisChapter;
  projectId: string;
  onSubmitForReview?: (chapterId: string) => void;
  onStartWriting?: (chapterId: string) => void;
  canReview?: boolean;
  loading?: boolean;
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
  loading = false,
}: ChapterCardProps) {
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ChapterHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function toggleHistory() {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next && !history) {
      setHistoryLoading(true);
      try {
        const res = await fetch(`/api/thesis/chapters/${chapter.id}/history`);
        if (res.ok) {
          setHistory(await res.json());
        }
      } finally {
        setHistoryLoading(false);
      }
    }
  }
  const cfg = CHAPTER_STATUS_CONFIG[chapter.status];
  const StatusIcon = statusIcon[chapter.status] ?? FileText;
  const isOverdue =
    chapter.target_date &&
    new Date(chapter.target_date) < new Date() &&
    chapter.status !== "approved" &&
    chapter.status !== "locked";

  return (
    <div
      className={cn("rounded-lg border p-4 transition-shadow hover:shadow-sm", cfg.border)}
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Chapter info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
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

          <h3 className="font-semibold text-sm mb-2" style={{ color: "var(--text-primary)" }}>{chapter.title}</h3>

          <div className="flex flex-wrap gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
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
              className="text-xs font-medium text-[var(--accent-blue)] hover:underline px-3 py-1.5 rounded border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] transition-colors whitespace-nowrap"
            >
              Open Document
            </Link>
          ) : onStartWriting ? (
            <button
              onClick={() => onStartWriting(chapter.id)}
              disabled={loading}
              className="text-xs font-medium text-[var(--accent-blue)] px-3 py-1.5 rounded border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating…" : "Start Writing"}
            </button>
          ) : null}

          {chapter.status === "drafting" && onSubmitForReview && (
            confirmingSubmit ? (
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Submit?</span>
                <button
                  onClick={() => { setConfirmingSubmit(false); onSubmitForReview(chapter.id); }}
                  className="text-xs font-medium text-purple-600 hover:text-purple-700 px-2 py-1 rounded border border-purple-200 hover:bg-purple-50 transition-colors whitespace-nowrap"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmingSubmit(false)}
                  className="text-xs font-medium px-2 py-1 rounded border transition-colors whitespace-nowrap"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingSubmit(true)}
                className="text-xs font-medium text-purple-600 hover:text-purple-700 px-3 py-1.5 rounded border border-purple-200 hover:bg-purple-50 transition-colors whitespace-nowrap"
              >
                Submit for Review
              </button>
            )
          )}

          {chapter.status === "revision_requested" && onSubmitForReview && (
            confirmingSubmit ? (
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Resubmit?</span>
                <button
                  onClick={() => { setConfirmingSubmit(false); onSubmitForReview(chapter.id); }}
                  className="text-xs font-medium text-amber-600 hover:text-amber-700 px-2 py-1 rounded border border-amber-200 hover:bg-amber-50 transition-colors whitespace-nowrap"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmingSubmit(false)}
                  className="text-xs font-medium px-2 py-1 rounded border transition-colors whitespace-nowrap"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingSubmit(true)}
                className="text-xs font-medium text-amber-600 hover:text-amber-700 px-3 py-1.5 rounded border border-amber-200 hover:bg-amber-50 transition-colors whitespace-nowrap"
              >
                Resubmit
              </button>
            )
          )}
        </div>
      </div>

      {/* History toggle (footer) — gated behind workflow v2 */}
      {THESIS_WORKFLOW_V2 && (
        <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border-subtle)" }}>
          <button
            onClick={toggleHistory}
            className="flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{ color: "var(--text-tertiary)" }}
          >
            <History className="h-3 w-3" />
            History
            <ChevronDown className={cn("h-3 w-3 transition-transform", historyOpen && "rotate-180")} />
          </button>
        </div>
      )}

      {THESIS_WORKFLOW_V2 && historyOpen && (
        <div className="mt-3 space-y-2">
          {historyLoading && (
            <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>Loading history…</div>
          )}
          {history && history.submissions.length === 0 && history.versions.length === 0 && (
            <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>No history yet.</div>
          )}
          {history && history.submissions.map(s => (
            <div
              key={s.id}
              className="rounded-md border p-2.5 text-xs"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface-hover)" }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  Round {s.round}
                  {s.document_version_number != null && (
                    <span className="ml-1.5 font-normal" style={{ color: "var(--text-tertiary)" }}>
                      · v{s.document_version_number}
                    </span>
                  )}
                </span>
                <span style={{ color: "var(--text-tertiary)" }}>{formatDate(s.submitted_at)}</span>
              </div>
              {s.note && (
                <p className="mt-1" style={{ color: "var(--text-secondary)" }}>{s.note}</p>
              )}
              {s.decision && (
                <div className="mt-2 flex items-start gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                      s.decision === "approved" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700",
                    )}
                  >
                    {s.decision === "approved" ? "Approved" : "Revisions"}
                  </span>
                  <div className="flex-1 min-w-0">
                    {s.reviewer?.full_name && (
                      <span style={{ color: "var(--text-tertiary)" }}>
                        by {s.reviewer.full_name}
                        {s.reviewed_at ? ` · ${formatDate(s.reviewed_at)}` : ""}
                      </span>
                    )}
                    {s.feedback && (
                      <p className="mt-1" style={{ color: "var(--text-secondary)" }}>{s.feedback}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {history && history.comments.length > 0 && (
            <div className="rounded-md border p-2.5 text-xs" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="flex items-center gap-1.5 mb-2" style={{ color: "var(--text-tertiary)" }}>
                <MessageCircle className="h-3 w-3" />
                <span className="font-semibold">{history.comments.length} comment{history.comments.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-1.5">
                {history.comments.slice(0, 5).map(c => (
                  <div key={c.id}>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {c.author?.full_name ?? "—"}:{" "}
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>{c.content}</span>
                  </div>
                ))}
                {history.comments.length > 5 && (
                  <div style={{ color: "var(--text-tertiary)" }}>
                    +{history.comments.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  MessageSquare, ChevronRight, BookOpen, CheckSquare,
  Shield, CheckCircle2, Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface SupervisorNote {
  id: string;
  content: string;
  artifact_type: string;
  is_resolved: boolean;
  created_at: string;
  supervisor?: { full_name: string | null };
}

interface SupervisionRecord {
  id: string;
  title: string;
  summary: string;
  action_items: string[];
  created_at: string;
}

interface ThesisRightPanelProps {
  projectId: string;
  userId: string;
  supervisorName: string | null;
  approvedChapters: number;
  totalChapters: number;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ThesisRightPanel({
  projectId,
  userId,
  supervisorName,
  approvedChapters,
  totalChapters,
}: ThesisRightPanelProps) {
  const [notes, setNotes] = useState<SupervisorNote[]>([]);
  const [sessions, setSessions] = useState<SupervisionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const supervisorInitials = (supervisorName ?? "S")
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const load = useCallback(async () => {
    const [notesRes, sessionsRes] = await Promise.all([
      fetch(`/api/supervision/annotations?studentId=${userId}`),
      fetch(`/api/supervision/records?studentId=${userId}`),
    ]);
    if (notesRes.ok) {
      const data = await notesRes.json();
      if (Array.isArray(data)) setNotes(data);
    }
    if (sessionsRes.ok) {
      const data = await sessionsRes.json();
      if (Array.isArray(data)) setSessions(data);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const unresolvedNotes = notes.filter(n => !n.is_resolved);

  async function markNoteRead(noteId: string) {
    await fetch("/api/supervision/annotations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: noteId, is_resolved: true }),
    });
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, is_resolved: true } : n));
  }

  async function markAllRead() {
    await Promise.all(unresolvedNotes.map(n => markNoteRead(n.id)));
  }

  if (loading) return (
    <div className="space-y-3">
      {[1, 2].map(i => (
        <div key={i} className="h-32 rounded-lg animate-pulse" style={{ background: "var(--bg-surface)" }} />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">

      {/* Progress summary */}
      <div className="rounded-lg border overflow-hidden" style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
        <div className="px-3 py-2.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Progress</span>
        </div>
        <div className="px-3 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{approvedChapters}</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>approved</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{totalChapters - approvedChapters}</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>remaining</span>
          </div>
        </div>
        {totalChapters > 0 && (
          <div className="px-3 pb-3">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-surface-active)" }}>
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.round((approvedChapters / totalChapters) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
              {Math.round((approvedChapters / totalChapters) * 100)}% complete
            </p>
          </div>
        )}
      </div>

      {/* Supervisor notes */}
      <div className="rounded-lg border overflow-hidden" style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
        <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-white font-mono font-semibold flex-shrink-0"
            style={{ background: "#1B3A5C", fontSize: 9 }}
          >
            {supervisorInitials}
          </div>
          <span className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {supervisorName ?? "Supervisor"}
          </span>
          {unresolvedNotes.length > 0 && (
            <>
              <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-blue-subtle border border-blue-200 flex-shrink-0" style={{ color: "var(--accent-blue)" }}>
                {unresolvedNotes.length}
              </span>
              <button
                onClick={markAllRead}
                className="text-[10px] font-semibold flex-shrink-0 hover:opacity-70"
                style={{ color: "var(--text-tertiary)" }}
              >
                Mark all read
              </button>
            </>
          )}
        </div>

        {notes.length === 0 ? (
          <div className="px-3 py-5 text-center text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            No notes yet
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {[...unresolvedNotes, ...notes.filter(n => n.is_resolved)].slice(0, 5).map(note => (
              <div
                key={note.id}
                className="group flex gap-2 items-start px-3 py-2.5 relative transition-colors"
                style={{ background: "inherit" }}
              >
                {!note.is_resolved && (
                  <div className="absolute left-1 top-4 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--accent-blue)" }} />
                )}
                <MessageSquare
                  className={cn("h-3 w-3 flex-shrink-0 mt-0.5")}
                  style={{ color: note.is_resolved ? "var(--text-tertiary)" : "var(--text-secondary)" }}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[12px] truncate"
                    style={{ color: note.is_resolved ? "var(--text-secondary)" : "var(--text-primary)", fontWeight: note.is_resolved ? 400 : 600 }}
                  >
                    Note on {note.artifact_type}
                  </div>
                  <div className="text-[11px] mt-0.5 line-clamp-2 leading-snug" style={{ color: "var(--text-secondary)" }}>
                    {note.content}
                  </div>
                </div>
                {!note.is_resolved && (
                  <button
                    onClick={() => markNoteRead(note.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5 text-[10px] font-semibold hover:opacity-70"
                    style={{ color: "var(--text-tertiary)" }}
                    title="Mark as read"
                  >
                    ✓
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="px-3 py-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <Link
            href={`/projects/${projectId}`}
            className="text-[11px] font-semibold flex items-center gap-1 hover:underline"
            style={{ color: "var(--accent-blue)" }}
          >
            Open project to reply <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div className="rounded-lg border overflow-hidden" style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
          <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <BookOpen className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Sessions</span>
            <span className="ml-auto text-[10px]" style={{ color: "var(--text-tertiary)" }}>{sessions.length}</span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {sessions.slice(0, 3).map(session => (
              <div key={session.id} className="px-3 py-2.5">
                <div className="text-[12px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{session.title}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {new Date(session.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </div>
                {session.action_items?.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {session.action_items.slice(0, 2).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        <CheckSquare className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: "var(--text-tertiary)" }} />
                        <span className="line-clamp-1">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit trail link */}
      <Link
        href={`/projects/${projectId}/audit`}
        className="flex items-center gap-2 text-xs font-medium rounded-lg border px-3 py-2.5 transition-opacity hover:opacity-70"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
      >
        <Shield className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} />
        View immutable audit ledger
        <ChevronRight className="h-3 w-3 ml-auto" style={{ color: "var(--text-tertiary)" }} />
      </Link>
    </div>
  );
}

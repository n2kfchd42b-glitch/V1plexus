"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { ArrowLeft, History } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logAudit, logAuditBeacon } from "@/lib/audit";
import { useAuth } from "@/hooks/useAuth";
import { EditorToolbar } from "./EditorToolbar";
import { AIAssistPopover } from "@/components/ai/AIAssistPopover";
import { VersionHistory } from "./VersionHistory";
import { SaveVersionButton } from "./SaveVersionButton";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { formatRelativeTime } from "@/lib/utils";
import { TableBlockNodeExtension } from "./extensions/TableBlockNode";
import type { Document, DocumentVersion, Json } from "@/lib/types/database";

function getTextContent(json: Json): string {
  if (!json || typeof json !== "object" || Array.isArray(json)) return "";
  const node = json as Record<string, Json>;
  let text = "";
  if (node.type === "text" && typeof node.text === "string") {
    text += node.text + " ";
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += getTextContent(child);
    }
  }
  return text;
}

function wordCount(json: Json): number {
  const text = getTextContent(json).trim();
  if (!text) return 0;
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

export function DocumentEditor({
  document: doc,
  projectId,
  initialVersions,
}: {
  document: Document;
  projectId: string;
  initialVersions: DocumentVersion[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();

  const [title, setTitle] = useState(doc.title);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>(initialVersions);
  const [currentVersion, setCurrentVersion] = useState(doc.current_version);
  const [words, setWords] = useState(doc.word_count);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit-session audit: one entry per meaningful editing session rather than
  // per-autosave, so the ledger doesn't get flooded by keystroke-level writes.
  // A session begins on the first change and closes on blur, explicit save,
  // 5-minute idle, or page unload.
  const sessionRef = useRef<{
    startedAt: Date;
    startWords: number;
    changes: number;
    logged: boolean;
  } | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
      LinkExtension.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      TableBlockNodeExtension,
    ],
    content: doc.content && Object.keys(doc.content).length > 0
      ? (doc.content as object)
      : undefined,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as Json;
      setWords(wordCount(json));
      scheduleSave(json);
      trackEditSession();
    },
  });

  const trackEditSession = useCallback(() => {
    if (!sessionRef.current) {
      sessionRef.current = {
        startedAt: new Date(),
        startWords: words,
        changes: 0,
        logged: false,
      };
    }
    sessionRef.current.changes++;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => closeEditSession("idle"), 5 * 60 * 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);

  const closeEditSession = useCallback(
    async (reason: "blur" | "idle" | "save" | "unload") => {
      const session = sessionRef.current;
      if (!session || session.logged || session.changes === 0) return;
      session.logged = true;
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      const endedAt = new Date();
      const details = {
        summary: `Edited "${doc.title}"`,
        operation: {
          reason,
          started_at: session.startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          duration_seconds: Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000),
          change_count: session.changes,
          words_before: session.startWords,
          words_after: words,
          word_delta: words - session.startWords,
        },
      };
      if (reason === "unload" && user) {
        logAuditBeacon(user.id, "document.edited", "document", doc.id, details, projectId);
      } else {
        await logAudit("document.edited", "document", doc.id, details, projectId);
      }
      sessionRef.current = null;
    },
    [doc.id, doc.title, projectId, user, words],
  );

  const scheduleSave = useCallback(
    (content: Json) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        autoSave(content);
      }, 3000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function autoSave(content: Json) {
    setSaving(true);
    const wc = wordCount(content);
    await supabase
      .from("documents")
      .update({ content, word_count: wc, updated_at: new Date().toISOString() })
      .eq("id", doc.id);
    setSaving(false);
    setLastSaved(new Date());
  }

  async function handleTitleBlur() {
    if (title === doc.title) return;
    const oldTitle = doc.title;
    await supabase.from("documents").update({ title }).eq("id", doc.id);
    await logAudit(
      "document.edited",
      "document",
      doc.id,
      {
        summary: `Renamed document "${oldTitle}" → "${title}"`,
        operation: { change: "title", from: oldTitle, to: title },
      },
      projectId,
    );
  }

  async function saveVersion(summary: string) {
    if (!editor) return;
    const content = editor.getJSON() as Json;
    const wc = wordCount(content);
    const nextVersion = currentVersion + 1;

    const { data: versionData } = await supabase
      .from("document_versions")
      .insert({
        document_id: doc.id,
        version_number: nextVersion,
        content,
        change_summary: summary || null,
        word_count: wc,
      })
      .select()
      .single();

    await supabase
      .from("documents")
      .update({ current_version: nextVersion, content, word_count: wc })
      .eq("id", doc.id);

    if (versionData) {
      setVersions((prev) => [...prev, versionData]);
    }
    setCurrentVersion(nextVersion);
    setLastSaved(new Date());
    await closeEditSession("save");
  }

  function handleRestoreVersion(version: DocumentVersion) {
    if (!editor) return;
    if (
      !window.confirm(
        `Restore to version ${version.version_number}? Current unsaved changes will be lost.`
      )
    )
      return;
    editor.commands.setContent(version.content as object);
    setWords(wordCount(version.content));
    setShowHistory(false);
  }

  // Cleanup timer on unmount + close any open edit session
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        void closeEditSession("unload");
      }
    };
    const handleBeforeUnload = () => {
      void closeEditSession("unload");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      void closeEditSession("unload");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/projects/${projectId}/documents`)}
            className="text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="text-lg font-semibold text-slate-900 border-none outline-none bg-transparent min-w-0 w-80"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
          >
            <History className="h-4 w-4" />
            History
          </button>
          <SaveVersionButton onSave={saveVersion} disabled={!editor} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-200 flex-wrap">
        <EditorToolbar editor={editor} />
        {editor && (
          <>
            <div className="h-5 w-px bg-slate-200 mx-1" />
            <AIAssistPopover editor={editor} documentId={doc.id} />
          </>
        )}
      </div>

      {/* Content area + history panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[720px] mx-auto px-8 py-8">
            <EditorContent editor={editor} className="min-h-[500px]" />
          </div>
        </div>

        {showHistory && (
          <VersionHistory
            versions={versions}
            currentVersion={currentVersion}
            onClose={() => setShowHistory(false)}
            onRestore={handleRestoreVersion}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-6 py-2 border-t border-slate-200 text-xs text-slate-400 bg-slate-50">
        <span>Words: {words.toLocaleString()}</span>
        <span>·</span>
        <span>
          {saving
            ? "Saving…"
            : lastSaved
            ? `Last saved: ${formatRelativeTime(lastSaved)}`
            : "Not yet saved"}
        </span>
        <span>·</span>
        <DocumentStatusBadge status={doc.status} />
        <span>·</span>
        <span>v{currentVersion}</span>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, GripVertical } from "lucide-react";
import type { ThesisChapter } from "@/types/database";
import { ChapterCard } from "./ChapterCard";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ChapterListProps {
  projectId: string;
  chapters: ThesisChapter[];
  canEdit?: boolean;
}

export function ChapterList({ projectId, chapters: initialChapters, canEdit }: ChapterListProps) {
  const [chapters, setChapters] = useState(initialChapters);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  const sorted = [...chapters].sort((a, b) => (a.sort_order ?? a.chapter_number) - (b.sort_order ?? b.chapter_number));

  async function handleStartWriting(chapterId: string) {
    if (!user || actionLoading) return;
    setActionLoading(chapterId);
    try {
      const supabase = createClient();
      const chapter = chapters.find(c => c.id === chapterId);
      if (!chapter) return;

      // Create a document for this chapter
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          project_id: projectId,
          title: chapter.title,
          doc_type: "general",
          content: null,
          status: "draft",
          created_by: user.id,
          current_version: 1,
        })
        .select("id")
        .single();
      if (docError || !doc) throw new Error(docError?.message ?? "Failed to create document");

      // Link the document to the chapter and move status to drafting
      const { error: chapterError } = await supabase
        .from("thesis_chapters")
        .update({ document_id: doc.id, status: "drafting" })
        .eq("id", chapterId);
      if (chapterError) throw new Error(chapterError.message);

      setChapters(prev =>
        prev.map(c => c.id === chapterId ? { ...c, document_id: doc.id, status: "drafting" as const } : c)
      );
      router.push(`/projects/${projectId}/documents/${doc.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSubmitForReview(chapterId: string) {
    if (actionLoading) return;
    setActionLoading(chapterId);
    try {
      const res = await fetch(`/api/thesis/chapters/${chapterId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.formErrors?.join(", ") ?? body.error ?? "Submit failed");
      const submittedAt = new Date().toISOString();
      setChapters(prev =>
        prev.map(c =>
          c.id === chapterId
            ? { ...c, status: "submitted_for_review" as const, submitted_at: submittedAt }
            : c,
        ),
      );
      toast.success(`Chapter submitted for review (round ${body.round})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddChapter() {
    if (!newTitle.trim()) return;
    const supabase = createClient();
    const newChapter = {
      project_id: projectId,
      chapter_number: chapters.length + 1,
      title: newTitle.trim(),
      status: "not_started" as const,
      sort_order: chapters.length,
    };
    const { data, error } = await supabase
      .from("thesis_chapters")
      .insert(newChapter)
      .select()
      .single();
    if (error || !data) { toast.error("Failed to add chapter"); return; }
    setChapters(prev => [...prev, data as ThesisChapter]);
    setNewTitle("");
    setShowAddForm(false);
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  async function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    const updated = reordered.map((c, i) => ({ ...c, sort_order: i }));
    setChapters(updated);
    setDragIndex(index);

    const supabase = createClient();
    await Promise.all(
      updated.map(c =>
        supabase.from("thesis_chapters").update({ sort_order: c.sort_order }).eq("id", c.id)
      )
    );
  }

  if (chapters.length === 0 && !canEdit) {
    return (
      <div className="text-center py-16 text-[var(--text-tertiary)]">
        <p className="text-sm">No chapters have been added yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((chapter, index) => (
        <div
          key={chapter.id}
          className="flex items-stretch gap-2"
          draggable={canEdit}
          onDragStart={() => handleDragStart(index)}
          onDragOver={e => handleDragOver(e, index)}
        >
          {canEdit && (
            <div className="flex items-center cursor-grab active:cursor-grabbing px-1" style={{ color: "var(--text-tertiary)" }}>
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <div className="flex-1">
            <ChapterCard
              chapter={chapter}
              projectId={projectId}
              onStartWriting={canEdit ? handleStartWriting : undefined}
              onSubmitForReview={handleSubmitForReview}
              loading={actionLoading === chapter.id}
            />
          </div>
        </div>
      ))}

      {canEdit && (
        <div className="mt-2">
          {showAddForm ? (
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddChapter()}
                placeholder="Chapter title..."
                className="flex-1 text-sm rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20"
              style={{ border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
              />
              <button
                onClick={handleAddChapter}
                className="text-sm px-3 py-2 rounded text-white btn-primary"
              >
                Add
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewTitle(""); }}
                className="text-sm px-3 py-2 rounded"
                style={{ border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: "var(--accent-blue)" }}
            >
              <Plus className="h-4 w-4" />
              Add Chapter
            </button>
          )}
        </div>
      )}
    </div>
  );
}

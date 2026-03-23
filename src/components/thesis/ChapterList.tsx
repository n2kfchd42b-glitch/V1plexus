"use client";

import { useState } from "react";
import { Plus, GripVertical } from "lucide-react";
import { ThesisChapter } from "@/lib/types/thesis";
import { ChapterCard } from "./ChapterCard";

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

  const sorted = [...chapters].sort((a, b) => (a.sort_order ?? a.chapter_number) - (b.sort_order ?? b.chapter_number));

  function handleAddChapter() {
    if (!newTitle.trim()) return;
    const next: ThesisChapter = {
      id: `temp-${Date.now()}`,
      project_id: projectId,
      document_id: null,
      chapter_number: chapters.length + 1,
      title: newTitle.trim(),
      status: "not_started",
      target_date: null,
      submitted_at: null,
      approved_at: null,
      approved_by: null,
      sort_order: chapters.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setChapters(prev => [...prev, next]);
    setNewTitle("");
    setShowAddForm(false);
    // TODO: persist to Supabase
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    setChapters(reordered.map((c, i) => ({ ...c, sort_order: i })));
    setDragIndex(index);
  }

  if (chapters.length === 0 && !canEdit) {
    return (
      <div className="text-center py-16 text-gray-500">
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
            <div className="flex items-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 px-1">
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <div className="flex-1">
            <ChapterCard chapter={chapter} projectId={projectId} />
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
                className="flex-1 text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddChapter}
                className="text-sm px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewTitle(""); }}
                className="text-sm px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
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

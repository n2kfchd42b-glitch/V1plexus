"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import * as Y from 'yjs'
import { createClient } from '@/lib/supabase/client'
import { SupabaseProvider, getUserColor } from '@/lib/collaboration'
import { OnlineUsers, type OnlineUser } from './OnlineUsers'
import { EditorToolbar } from './EditorToolbar'
import { CommentsSidebar } from './CommentsSidebar'
import { Button } from '@/components/ui/button'
import { MessageSquare, Save, Send, Sparkles, SpellCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/database'
import { AIAssistPopover } from '@/components/ai/AIAssistPopover'
import { GenerateSectionModal } from '@/components/ai/GenerateSectionModal'
import { GrammarCheckPanel } from '@/components/ai/GrammarCheckPanel'

interface CollaborativeEditorProps {
  documentId: string
  projectId: string
  currentProfile: Profile | null
  initialContent?: Record<string, unknown> | null
  onSave?: (content: Record<string, unknown>) => void
  onSubmitForReview?: () => void
  readOnly?: boolean
}

export function CollaborativeEditor({
  documentId,
  projectId,
  currentProfile,
  initialContent,
  onSave,
  onSubmitForReview,
  readOnly = false,
}: CollaborativeEditorProps) {
  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<SupabaseProvider | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [showComments, setShowComments] = useState(false)
  const [showGrammar, setShowGrammar] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  // Initialize Yjs doc and Supabase provider
  useEffect(() => {
    if (!currentProfile) return

    const ydoc = new Y.Doc()
    ydocRef.current = ydoc

    // Load initial content into Yjs doc if no existing state
    if (initialContent) {
      // We'll let the editor handle initial content via TipTap's content prop
      // The Yjs doc will be populated from the editor state
    }

    const channel = supabase.channel(`document:${documentId}`)
    const provider = new SupabaseProvider(ydoc, channel, documentId, {
      id: currentProfile.id,
      name: currentProfile.full_name ?? currentProfile.email,
      color: getUserColor(currentProfile.id),
    })
    providerRef.current = provider

    // Track awareness / online users
    const updateUsers = () => {
      const states = provider.awareness.getStates()
      const users: OnlineUser[] = []
      states.forEach((state, clientId) => {
        if (state.user && clientId !== ydoc.clientID) {
          users.push(state.user as OnlineUser)
        }
      })
      setOnlineUsers(users)
    }

    provider.awareness.on('change', updateUsers)

    return () => {
      provider.awareness.off('change', updateUsers)
      provider.destroy()
      supabase.removeChannel(channel)
    }
  }, [documentId, currentProfile, supabase])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydocRef.current ?? new Y.Doc() }),
      CollaborationCursor.configure({
        provider: providerRef.current?.awareness,
        user: currentProfile
          ? {
              name: currentProfile.full_name ?? currentProfile.email,
              color: getUserColor(currentProfile.id),
            }
          : undefined,
      }),
      Placeholder.configure({ placeholder: 'Start writing your document...' }),
      Highlight,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
    ],
    content: initialContent as Record<string, unknown> | undefined ?? undefined,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (readOnly) return
      // Debounced auto-save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        handleAutoSave(editor.getJSON())
      }, 3000)
    },
  }, [ydocRef.current])

  const handleAutoSave = useCallback(async (content: Record<string, unknown>) => {
    setSaving(true)
    try {
      await supabase
        .from('documents')
        .update({
          content,
          content_text: '',
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)
      setLastSaved(new Date())
      onSave?.(content)
    } finally {
      setSaving(false)
    }
  }, [documentId, supabase, onSave])

  const handleManualSave = async () => {
    if (!editor) return
    await handleAutoSave(editor.getJSON())
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {!readOnly && (
        <div className="border-b bg-card px-4 py-2 flex items-center justify-between gap-2">
          <EditorToolbar editor={editor} />
          <div className="flex items-center gap-2 shrink-0">
            <OnlineUsers users={onlineUsers} />
            {editor && (
              <AIAssistPopover editor={editor} documentId={documentId} />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setShowGenerateModal(true)}
              title="Generate section with AI"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setShowGrammar(!showGrammar)}
            >
              <SpellCheck className="h-3.5 w-3.5" />
              Check
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowComments(!showComments)}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Comments
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleManualSave}
              disabled={saving}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              {saving ? 'Saving...' : lastSaved ? 'Saved' : 'Save'}
            </Button>
            {onSubmitForReview && (
              <Button size="sm" className="h-7 text-xs" onClick={onSubmitForReview}>
                <Send className="h-3.5 w-3.5 mr-1" />
                Submit for Review
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Editor + Comments */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <EditorContent
            editor={editor}
            className={cn(
              'prose prose-sm max-w-none px-8 py-6 min-h-full focus:outline-none',
              '[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[400px]',
              '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground',
              '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
              '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
              '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
              '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0',
            )}
          />
        </div>

        {showComments && currentProfile && (
          <CommentsSidebar
            documentId={documentId}
            currentProfile={currentProfile}
            onClose={() => setShowComments(false)}
          />
        )}

        {showGrammar && editor && (
          <GrammarCheckPanel
            editor={editor}
            documentId={documentId}
            onClose={() => setShowGrammar(false)}
          />
        )}
      </div>

      {showGenerateModal && editor && (
        <GenerateSectionModal
          open={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          editor={editor}
          documentId={documentId}
        />
      )}
    </div>
  )
}

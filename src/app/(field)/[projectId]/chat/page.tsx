'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Send, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { FieldBottomNav } from '@/components/field/FieldBottomNav'
import type { ProjectMessage } from '@/types/database'

export default function FieldChatPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const supabase = createClient()
  const { user } = useAuth()
  const [messages, setMessages] = useState<ProjectMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    const { data } = await supabase
      .from('project_messages')
      .select('*, sender:profiles(id, full_name, avatar_url)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages((data ?? []) as ProjectMessage[])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`messages-${projectId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'project_messages', filter: `project_id=eq.${projectId}` },
        () => load()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, supabase])

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return
    setSending(true)
    try {
      const { error } = await supabase
        .from('project_messages')
        .insert({ project_id: projectId, sender_id: user.id, content: newMessage.trim() })
      if (error) throw error
      setNewMessage('')
    } catch {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href={`/field/${projectId}`}><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
        <div>
          <p className="text-sm font-semibold text-gray-800">Team Chat</p>
          <p className="text-xs text-gray-400">Field coordination</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map(msg => {
          const isMe = msg.sender_id === user?.id
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {(msg.sender?.full_name ?? 'U').charAt(0).toUpperCase()}
              </div>
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isMe && <p className="text-[11px] text-gray-400">{msg.sender?.full_name ?? 'Unknown'}</p>}
                <div className={`px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>
                  {msg.content}
                </div>
                <p className="text-[10px] text-gray-400">
                  {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          )
        })}
        {messages.length === 0 && (
          <div className="text-center text-sm text-gray-400 py-12">
            No messages yet. Start the conversation!
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 p-3 flex gap-2">
        <input
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Message the team…"
          className="flex-1 text-sm bg-gray-100 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSend}
          disabled={!newMessage.trim() || sending}
          className="h-9 w-9 flex items-center justify-center bg-blue-600 text-white rounded-full disabled:opacity-50 flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      <FieldBottomNav projectId={projectId} />
    </div>
  )
}

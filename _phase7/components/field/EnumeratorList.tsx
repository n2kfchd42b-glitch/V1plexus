'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Enumerator {
  id: string
  name: string
  submissions: number
  flags: number
  status: 'active' | 'idle' | 'flagged'
}

export function EnumeratorList({ projectId }: { projectId: string }) {
  const supabase = createClient()
  const [enumerators, setEnumerators] = useState<Enumerator[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      // Get project members as enumerators
      const { data: members } = await supabase
        .from('project_members')
        .select('user_id, profiles:user_id(id, full_name)')
        .eq('project_id', projectId)
        .limit(20)

      if (!members?.length) { setLoading(false); return }

      // Simulate enumerator stats based on project members
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: Enumerator[] = (members as any[]).map((m: { user_id: string; profiles: { id: string; full_name: string | null } | null }) => ({
        id: m.user_id,
        name: m.profiles?.full_name ?? 'Unknown',
        submissions: 0,
        flags: 0,
        status: 'idle' as const,
      }))

      setEnumerators(list)
      setLoading(false)
    }
    load()
  }, [projectId, supabase])

  if (loading) {
    return <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-400">Loading team…</div>
  }

  if (!enumerators.length) {
    return <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-400">No team members found.</div>
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {enumerators.slice(0, 8).map((e, i) => (
        <div
          key={e.id}
          className={`flex items-center justify-between px-4 py-3 ${i < enumerators.length - 1 ? 'border-b border-gray-100' : ''}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
              {e.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-gray-800 truncate">{e.name}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm font-medium text-gray-600">{e.submissions}</span>
            {e.flags > 0 ? (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />{e.flags}
              </span>
            ) : e.status === 'active' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <Clock className="h-4 w-4 text-gray-300" />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

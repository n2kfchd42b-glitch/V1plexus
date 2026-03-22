"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useWorkspaceContext } from '@/components/workspace/WorkspaceProvider'
import { Copy, RefreshCw } from 'lucide-react'

export function InvitationLinkGenerator() {
  const { activeWorkspace } = useWorkspaceContext()
  const [link, setLink] = useState('')
  const [generating, setGenerating] = useState(false)
  const supabase = createClient()

  const generateLink = async () => {
    if (!activeWorkspace) return
    setGenerating(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGenerating(false); return }

    const token = crypto.randomUUID().replace(/-/g, '')
    const { error } = await supabase
      .from('workspace_invitations')
      .insert({
        workspace_id: activeWorkspace.id,
        email: `link-invite-${token}@plexus.internal`,
        role: 'student',
        token,
        invited_by: user.id,
        status: 'pending',
      })

    if (error) {
      toast.error(error.message)
    } else {
      const url = `${window.location.origin}/invite/${token}`
      setLink(url)
    }

    setGenerating(false)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(link)
    toast.success('Link copied!')
  }

  return (
    <div>
      <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Share invitation link</h4>
      <p className="text-xs text-[var(--text-tertiary)] mb-3">
        Anyone with this link can request to join as a member.
      </p>
      {link ? (
        <div className="flex gap-2">
          <Input value={link} readOnly className="flex-1 h-8 text-xs font-mono" />
          <Button size="sm" variant="outline" onClick={copyLink} className="h-8 px-2">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={generateLink} className="h-8 px-2" disabled={generating}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={generateLink} disabled={generating}>
          {generating ? 'Generating…' : 'Generate Invitation Link'}
        </Button>
      )}
    </div>
  )
}

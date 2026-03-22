"use client"

import { useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { ApprovalGateList } from '@/components/approval/ApprovalGateList'
import { GitMerge } from 'lucide-react'

export default function ApprovalsPage() {
  const params = useParams()
  const projectId = params.id as string
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-3">
        <div className="skeleton h-6 w-40 mb-6" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4 h-16" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-9 w-9 rounded-lg bg-[var(--bg-inset)] flex items-center justify-center">
          <GitMerge className="h-4.5 w-4.5 text-[var(--text-secondary)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Approval Gates</h2>
          <p className="text-sm text-[var(--text-tertiary)]">
            Milestone checkpoints that must be approved before proceeding
          </p>
        </div>
      </div>

      <ApprovalGateList projectId={projectId} currentProfile={profile} />
    </div>
  )
}

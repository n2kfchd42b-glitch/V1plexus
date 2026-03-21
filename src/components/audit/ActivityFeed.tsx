"use client"

import { AuditLogViewer } from './AuditLogViewer'

interface ActivityFeedProps {
  projectId: string
}

export function ActivityFeed({ projectId }: ActivityFeedProps) {
  return <AuditLogViewer projectId={projectId} compact />
}

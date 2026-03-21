'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GitCommit, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { DatasetVersion } from '@/types/database'

interface VersionSelectorProps {
  versions: DatasetVersion[]
  currentVersionId: string
  onVersionChange: (versionId: string) => void
}

export function VersionSelector({ versions, currentVersionId, onVersionChange }: VersionSelectorProps) {
  return (
    <Select value={currentVersionId} onValueChange={onVersionChange}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select version" />
      </SelectTrigger>
      <SelectContent>
        {versions.map(v => (
          <SelectItem key={v.id} value={v.id}>
            <div className="flex items-center gap-2">
              <GitCommit className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <span className="font-medium">v{v.version_number}</span>
              <span className="text-gray-500 text-xs truncate max-w-32">{v.commit_message}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

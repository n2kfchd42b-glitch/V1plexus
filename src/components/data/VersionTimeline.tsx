'use client'

import { formatDistanceToNow, format } from 'date-fns'
import { GitCommit, GitBranch } from 'lucide-react'
import type { DatasetVersion, DatasetBranch } from '@/types/database'

interface VersionTimelineProps {
  versions: DatasetVersion[]
  branches: DatasetBranch[]
  currentVersionId: string
  onVersionSelect: (versionId: string) => void
}

export function VersionTimeline({
  versions,
  branches,
  currentVersionId,
  onVersionSelect,
}: VersionTimelineProps) {
  if (versions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        No versions found.
      </div>
    )
  }

  // Build a map of versionId -> branches that point to it
  const branchesByVersion = new Map<string, DatasetBranch[]>()
  for (const branch of branches) {
    const existing = branchesByVersion.get(branch.head_version) ?? []
    branchesByVersion.set(branch.head_version, [...existing, branch])
  }

  // Sort versions: newest first by version number
  const sorted = [...versions].sort((a, b) => b.version_number - a.version_number)

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-gray-200" aria-hidden="true" />

      <div className="space-y-0">
        {sorted.map((version, index) => {
          const isCurrent = version.id === currentVersionId
          const branchesHere = branchesByVersion.get(version.id) ?? []
          const isLast = index === sorted.length - 1

          return (
            <div key={version.id} className="relative">
              <button
                onClick={() => onVersionSelect(version.id)}
                className={`w-full text-left flex items-start gap-4 px-4 py-3 rounded-lg transition-colors group ${
                  isCurrent
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                {/* Node circle */}
                <div className="relative z-10 shrink-0 mt-0.5">
                  <div
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${
                      isCurrent
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300 bg-white group-hover:border-blue-400'
                    }`}
                  >
                    <GitCommit
                      className={`h-3.5 w-3.5 ${isCurrent ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}`}
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-semibold ${
                        isCurrent ? 'text-blue-700' : 'text-gray-800'
                      }`}
                    >
                      v{version.version_number}
                    </span>

                    {/* Branch labels */}
                    {branchesHere.map(branch => (
                      <span
                        key={branch.id}
                        className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${
                          branch.is_default
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                      >
                        <GitBranch className="h-3 w-3" />
                        {branch.name}
                      </span>
                    ))}

                    {isCurrent && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium border border-blue-200">
                        current
                      </span>
                    )}
                  </div>

                  <p className={`text-sm mt-0.5 truncate ${isCurrent ? 'text-blue-600' : 'text-gray-600'}`}>
                    {version.commit_message}
                  </p>

                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span title={format(new Date(version.created_at), 'PPpp')}>
                      {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                    </span>
                    <span>{version.row_count.toLocaleString()} rows</span>
                    <span>{version.column_count} cols</span>
                  </div>
                </div>
              </button>

              {/* Connector line gap for last item */}
              {isLast && <div className="h-1" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

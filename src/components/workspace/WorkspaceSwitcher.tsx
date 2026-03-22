"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check, Plus, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspaceContext } from './WorkspaceProvider'
import { WorkspaceAvatar } from './WorkspaceAvatar'

interface WorkspaceSwitcherProps {
  collapsed?: boolean
}

export function WorkspaceSwitcher({ collapsed = false }: WorkspaceSwitcherProps) {
  const { activeWorkspace, allWorkspaces, switchWorkspace } = useWorkspaceContext()
  const [open, setOpen] = useState(false)
  const router = useRouter()

  if (!activeWorkspace) return null

  const personalWs = allWorkspaces.find(w => w.type === 'personal')
  const institutionalWs = allWorkspaces.filter(w => w.type === 'institutional')

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-2 rounded-md transition-colors duration-150',
          'hover:bg-white/5 text-white',
          collapsed ? 'justify-center p-1.5' : 'px-2 py-1.5'
        )}
        title={collapsed ? activeWorkspace.name : undefined}
      >
        <WorkspaceAvatar workspace={activeWorkspace} size="sm" />
        {!collapsed && (
          <>
            <span className="flex-1 min-w-0 text-sm font-medium text-left truncate">
              {activeWorkspace.name}
            </span>
            <ChevronDown className={cn(
              'h-3.5 w-3.5 flex-shrink-0 text-white/50 transition-transform duration-150',
              open && 'rotate-180'
            )} />
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className={cn(
            'absolute z-50 mt-1 rounded-lg border border-white/10 bg-[#1C1C1E] shadow-xl py-1 min-w-[220px]',
            collapsed ? 'left-full ml-2 top-0' : 'left-0 top-full'
          )}>
            {/* Personal workspace */}
            {personalWs && (
              <button
                onClick={() => { switchWorkspace(personalWs.id); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 text-left"
              >
                <WorkspaceAvatar workspace={personalWs} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{personalWs.name}</p>
                  <p className="text-xs text-white/40">Personal</p>
                </div>
                {activeWorkspace.id === personalWs.id && (
                  <Check className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                )}
              </button>
            )}

            {/* Institutional workspaces */}
            {institutionalWs.length > 0 && (
              <>
                {institutionalWs.map(ws => (
                  <button
                    key={ws.id}
                    onClick={() => { switchWorkspace(ws.id); setOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 text-left"
                  >
                    <WorkspaceAvatar workspace={ws} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{ws.name}</p>
                      <p className="text-xs text-white/40 truncate flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> Institution
                      </p>
                    </div>
                    {activeWorkspace.id === ws.id && (
                      <Check className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </>
            )}

            {/* Divider + actions */}
            <div className="my-1 h-px bg-white/10" />
            <button
              onClick={() => { router.push('/setup/institution/join'); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 text-left text-white/60 hover:text-white transition-colors"
            >
              <div className="h-6 w-6 rounded-md border border-dashed border-white/20 flex items-center justify-center">
                <Plus className="h-3 w-3" />
              </div>
              <span className="text-sm">Join an institution</span>
            </button>
            <button
              onClick={() => { router.push('/setup/institution/new'); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 text-left text-white/60 hover:text-white transition-colors"
            >
              <div className="h-6 w-6 rounded-md border border-dashed border-white/20 flex items-center justify-center">
                <Building2 className="h-3 w-3" />
              </div>
              <span className="text-sm">Create an institution</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

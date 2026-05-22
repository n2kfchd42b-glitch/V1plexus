'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Plus, Trash2, Check, Clock, ChevronDown, GripVertical,
  Search, Mail, X, Loader2, UserPlus, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  CREDIT_CATEGORIES,
  type CreditRole,
  getCreditLabel,
  getCreditDescription,
} from '@/lib/credit-taxonomy'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Author {
  id: string
  userId?: string | null
  displayName: string
  email?: string | null
  orcid?: string | null
  institution?: string | null
  creditRoles: CreditRole[]
  contributionOrder: number
  isCorresponding: boolean
  confirmedAt?: string | null
}

interface PlatformUser {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  title: string | null
}

interface AuthorshipPanelProps {
  documentId: string
  projectId: string
  onClose?: () => void
}

// ── Add-author dialog ─────────────────────────────────────────────────────────

function AddAuthorDialog({
  documentId,
  projectId,
  existingUserIds,
  onAdded,
  onClose,
}: {
  documentId: string
  projectId: string
  existingUserIds: string[]
  onAdded: () => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'search' | 'email'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlatformUser[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)

  // External author form
  const [extName, setExtName] = useState('')
  const [extEmail, setExtEmail] = useState('')
  const [sendInvite, setSendInvite] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const exclude = existingUserIds.join(',')
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}&exclude=${exclude}`)
      const data = await res.json()
      setResults(data.users ?? [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [existingUserIds])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  const addPlatformUser = async (u: PlatformUser) => {
    setAdding(u.id)
    try {
      const res = await fetch(`/api/documents/${documentId}/authors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: u.id,
          display_name: u.full_name ?? u.email,
          email: u.email,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add')
      toast.success(`${u.full_name ?? u.email} added as co-author`)
      onAdded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add co-author')
    } finally {
      setAdding(null)
    }
  }

  const addExternal = async () => {
    if (!extName.trim()) { toast.error('Name is required'); return }
    setSubmitting(true)
    try {
      // Add to document authors
      const res = await fetch(`/api/documents/${documentId}/authors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: extName.trim(), email: extEmail.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add')

      // Send project invite if email provided and option is checked
      if (extEmail.trim() && sendInvite) {
        await fetch('/api/invitations/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'project',
            email: extEmail.trim(),
            role: 'member',
            projectId,
          }),
        })
        toast.success(`${extName} added and invited to the project`)
      } else {
        toast.success(`${extName} added as co-author`)
      }
      onAdded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add author')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-xl bg-bg-surface border border-border-default shadow-xl overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Dialog header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-subtle">
          <div>
            <h2 className="font-manrope font-bold text-[15px] text-text-primary tracking-tight">Add Co-author</h2>
            <p className="text-[12px] text-text-tertiary mt-0.5">Find a Plexus user or invite by email</p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border-subtle">
          <button
            onClick={() => setTab('search')}
            className={cn(
              'flex-1 py-2.5 text-[12px] font-semibold tracking-wide transition-colors',
              tab === 'search'
                ? 'text-accent-blue border-b-2 border-accent-blue -mb-px'
                : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            <Search className="h-3.5 w-3.5 inline-block mr-1.5 -mt-px" />
            Find on Plexus
          </button>
          <button
            onClick={() => setTab('email')}
            className={cn(
              'flex-1 py-2.5 text-[12px] font-semibold tracking-wide transition-colors',
              tab === 'email'
                ? 'text-accent-blue border-b-2 border-accent-blue -mb-px'
                : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            <Mail className="h-3.5 w-3.5 inline-block mr-1.5 -mt-px" />
            Invite by Email
          </button>
        </div>

        <div className="p-5">
          {tab === 'search' ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
                <Input
                  autoFocus
                  placeholder="Search by name or email…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary animate-spin" />
                )}
              </div>

              {results.length > 0 ? (
                <div className="border border-border-subtle rounded-lg overflow-hidden divide-y divide-border-subtle max-h-52 overflow-y-auto">
                  {results.map(u => (
                    <div key={u.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-bg-row-hover transition-colors">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-text-primary truncate">{u.full_name ?? u.email}</p>
                        <p className="text-[11px] text-text-tertiary truncate">{u.email}{u.title ? ` · ${u.title}` : ''}</p>
                      </div>
                      <Button
                        size="sm"
                        className="ml-3 h-7 text-xs shrink-0"
                        disabled={adding === u.id}
                        onClick={() => addPlatformUser(u)}
                      >
                        {adding === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : query.length >= 2 && !searching ? (
                <div className="text-center py-6 text-text-tertiary">
                  <UserPlus className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  <p className="text-[12px]">No users found. Try the &ldquo;Invite by Email&rdquo; tab.</p>
                </div>
              ) : query.length > 0 && query.length < 2 ? (
                <p className="text-[11px] text-text-tertiary text-center py-2">Type at least 2 characters to search</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-1">
                  Full Name <span className="text-status-error">*</span>
                </label>
                <Input
                  autoFocus
                  placeholder="Dr. Jane Smith"
                  value={extName}
                  onChange={e => setExtName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-1">Email</label>
                <Input
                  type="email"
                  placeholder="jane@university.edu"
                  value={extEmail}
                  onChange={e => setExtEmail(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              {extEmail.trim() && (
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sendInvite}
                    onChange={e => setSendInvite(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border-default accent-blue-500"
                  />
                  <span className="text-[12px] text-text-secondary">Send project invitation email</span>
                </label>
              )}
              <Button
                size="sm"
                className="w-full h-8 text-sm"
                disabled={submitting || !extName.trim()}
                onClick={addExternal}
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <UserPlus className="h-3.5 w-3.5 mr-2" />}
                {submitting ? 'Adding…' : 'Add Co-author'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function AuthorshipPanel({ documentId, projectId, onClose }: AuthorshipPanelProps) {
  const [authors, setAuthors] = useState<Author[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [pendingRoles, setPendingRoles] = useState<Record<string, CreditRole[]>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchAuthors = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/authors`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const mapped: Author[] = (data.authors ?? []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        userId: a.user_id as string | null,
        displayName: a.display_name as string,
        email: a.email as string | null,
        orcid: a.orcid as string | null,
        institution: a.institution as string | null,
        creditRoles: (a.credit_roles as CreditRole[]) ?? [],
        contributionOrder: a.contribution_order as number,
        isCorresponding: a.is_corresponding as boolean,
        confirmedAt: a.confirmed_at as string | null,
      }))
      setAuthors(mapped)
    } catch {
      toast.error('Failed to load authors')
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => { fetchAuthors() }, [fetchAuthors])

  // ── CRediT role editing ──

  const localRoles = (author: Author): CreditRole[] =>
    pendingRoles[author.id] ?? author.creditRoles

  const toggleRole = (authorId: string, role: CreditRole, currentRoles: CreditRole[]) => {
    const next = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role]
    setPendingRoles(p => ({ ...p, [authorId]: next }))
  }

  const saveRoles = async (author: Author) => {
    const roles = localRoles(author)
    setSaving(author.id)
    try {
      const res = await fetch(`/api/documents/${documentId}/authors/${author.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credit_roles: roles }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAuthors(prev => prev.map(a => a.id === author.id ? { ...a, creditRoles: roles } : a))
      setPendingRoles(p => { const n = { ...p }; delete n[author.id]; return n })
      toast.success('Roles saved')
    } catch {
      toast.error('Failed to save roles')
    } finally {
      setSaving(null)
    }
  }

  // ── Delete ──

  const deleteAuthor = async (author: Author) => {
    setDeleting(author.id)
    try {
      const res = await fetch(`/api/documents/${documentId}/authors/${author.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      setAuthors(prev => prev.filter(a => a.id !== author.id))
      toast.success(`${author.displayName} removed`)
    } catch {
      toast.error('Failed to remove author')
    } finally {
      setDeleting(null)
    }
  }

  // ── Drag-to-reorder ──

  const handleDrop = useCallback(async (targetId: string) => {
    if (!draggingId || draggingId === targetId) return
    const next = [...authors]
    const fromIdx = next.findIndex(a => a.id === draggingId)
    const toIdx = next.findIndex(a => a.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    const reordered = next.map((a, i) => ({ ...a, contributionOrder: i }))
    setAuthors(reordered)
    setDraggingId(null)

    // Persist new orders
    await Promise.all(
      reordered.map(a =>
        fetch(`/api/documents/${documentId}/authors/${a.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contribution_order: a.contributionOrder }),
        })
      )
    )
  }, [draggingId, authors, documentId])

  const sorted = [...authors].sort((a, b) => a.contributionOrder - b.contributionOrder)
  const existingUserIds = authors.filter(a => a.userId).map(a => a.userId as string)

  return (
    <TooltipProvider>
      <div className="w-[300px] shrink-0 bg-bg-surface border-l border-border-subtle flex flex-col h-full overflow-hidden animate-slide-in-right">

        {/* Header */}
        <div className="shrink-0 h-10 flex items-center justify-between px-4 border-b border-border-subtle">
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
            Co-authors{authors.length > 0 ? ` · ${authors.length}` : ''}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="h-6 w-6 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Author list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
            </div>
          ) : authors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-3">
              <div className="h-10 w-10 rounded-full bg-bg-inset flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-text-tertiary opacity-50" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-text-primary mb-0.5">No co-authors yet</p>
                <p className="text-[11px] text-text-tertiary">Add collaborators to write together</p>
              </div>
              <Button size="sm" className="h-7 text-xs mt-1" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Co-author
              </Button>
            </div>
          ) : (
            <div>
              {sorted.map((author) => {
                const roles = localRoles(author)
                const hasChanges = pendingRoles[author.id] !== undefined
                return (
                  <div
                    key={author.id}
                    draggable
                    onDragStart={() => setDraggingId(author.id)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => handleDrop(author.id)}
                    onDragEnd={() => setDraggingId(null)}
                    className={cn(
                      'border-b border-border-subtle transition-colors',
                      draggingId === author.id && 'opacity-40 bg-bg-inset'
                    )}
                  >
                    {/* Author row */}
                    <div className="flex items-start gap-2 px-3 py-3 hover:bg-bg-row-hover transition-colors group">
                      <div className="cursor-move text-text-tertiary/40 mt-0.5 shrink-0 group-hover:text-text-tertiary transition-colors">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-text-primary truncate leading-tight">
                          {author.displayName}
                          {author.isCorresponding && (
                            <span className="ml-2 text-[9px] font-bold bg-accent-blue-subtle text-accent-blue px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Corresponding
                            </span>
                          )}
                        </p>
                        {author.email && (
                          <p className="text-[11px] text-text-tertiary truncate mt-0.5">{author.email}</p>
                        )}
                        {/* Confirmation status */}
                        {author.userId && (
                          <div className="flex items-center gap-1 mt-1">
                            {author.confirmedAt ? (
                              <span className="flex items-center gap-1 text-[10px] text-status-success font-medium">
                                <Check className="h-2.5 w-2.5" /> Confirmed
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] text-status-warning font-medium">
                                <Clock className="h-2.5 w-2.5" /> Pending confirmation
                              </span>
                            )}
                          </div>
                        )}
                        {roles.length > 0 && (
                          <p className="text-[10px] text-text-tertiary mt-1 truncate">
                            {roles.length} CRediT role{roles.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => setExpandedId(expandedId === author.id ? null : author.id)}
                          className="h-6 w-6 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
                        >
                          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expandedId === author.id && 'rotate-180')} />
                        </button>
                        <button
                          disabled={deleting === author.id}
                          onClick={() => deleteAuthor(author)}
                          className="h-6 w-6 flex items-center justify-center rounded text-text-tertiary hover:text-status-error hover:bg-status-error-bg transition-colors"
                        >
                          {deleting === author.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded: CRediT roles */}
                    {expandedId === author.id && (
                      <div className="px-3 pb-3 space-y-3 bg-bg-app border-t border-border-subtle">
                        <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider pt-3">CRediT Contribution Roles</p>
                        <div className="space-y-2.5">
                          {Object.entries(CREDIT_CATEGORIES).map(([category, categoryRoles]) => (
                            <div key={category}>
                              <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">{category}</p>
                              <div className="space-y-1 pl-2">
                                {categoryRoles.map(role => (
                                  <label key={role} className="flex items-start gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={roles.includes(role)}
                                      onChange={() => toggleRole(author.id, role, roles)}
                                      className="h-3 w-3 mt-0.5 rounded border-border-default accent-blue-500 shrink-0"
                                    />
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-[11px] text-text-secondary hover:text-text-primary leading-tight">
                                          {getCreditLabel(role)}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="max-w-[200px]">
                                        <p className="text-xs">{getCreditDescription(role)}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {hasChanges && (
                          <div className="flex items-center gap-2 pt-1">
                            <AlertCircle className="h-3 w-3 text-status-warning shrink-0" />
                            <span className="text-[10px] text-status-warning-text">Unsaved changes</span>
                            <Button
                              size="sm"
                              className="ml-auto h-6 text-xs px-3"
                              disabled={saving === author.id}
                              onClick={() => saveRoles(author)}
                            >
                              {saving === author.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {authors.length > 0 && (
          <div className="shrink-0 p-3 border-t border-border-subtle">
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Co-author
            </Button>
          </div>
        )}
      </div>

      {showAddDialog && (
        <AddAuthorDialog
          documentId={documentId}
          projectId={projectId}
          existingUserIds={existingUserIds}
          onAdded={() => { setShowAddDialog(false); fetchAuthors() }}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </TooltipProvider>
  )
}

'use client'

import { useState, useCallback, useMemo } from 'react'
import { Plus, Trash2, Mail, Check, Clock, ChevronDown, HelpCircle, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  CREDIT_TAXONOMY,
  CREDIT_CATEGORIES,
  type CreditRole,
  getCreditLabel,
  getCreditDescription,
} from '@/lib/credit-taxonomy'
import { toast } from 'sonner'

interface Author {
  id: string
  userId?: string
  displayName: string
  email?: string
  orcid?: string
  institution?: string
  creditRoles: CreditRole[]
  contributionOrder: number
  isCorresponding: boolean
  confirmedAt?: string
  createdAt: string
}

interface AuthorshipPanelProps {
  documentId: string
  authors: Author[]
  onAuthorsChange: (authors: Author[]) => void
  onSave?: () => Promise<void>
  isLoading?: boolean
}

export function AuthorshipPanel({
  documentId,
  authors,
  onAuthorsChange,
  onSave,
  isLoading,
}: AuthorshipPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Sort authors by contribution order
  const sortedAuthors = useMemo(
    () => [...authors].sort((a, b) => a.contributionOrder - b.contributionOrder),
    [authors]
  )

  const handleAddAuthor = () => {
    const newAuthor: Author = {
      id: `new-${Date.now()}`,
      displayName: '',
      creditRoles: [],
      contributionOrder: authors.length,
      isCorresponding: false,
      createdAt: new Date().toISOString(),
    }
    onAuthorsChange([...authors, newAuthor])
    setEditingId(newAuthor.id)
  }

  const handleUpdateAuthor = (id: string, updates: Partial<Author>) => {
    onAuthorsChange(
      authors.map((a) => (a.id === id ? { ...a, ...updates } : a))
    )
  }

  const handleDeleteAuthor = (id: string) => {
    const remaining = authors.filter((a) => a.id !== id)
    // Reorder remaining authors
    const reordered = remaining.map((a, idx) => ({
      ...a,
      contributionOrder: idx,
    }))
    onAuthorsChange(reordered)
    toast.success('Author removed')
  }

  const handleDragStart = (id: string) => {
    setDraggingId(id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return

    const newAuthors = [...authors]
    const draggedIdx = newAuthors.findIndex((a) => a.id === draggingId)
    const targetIdx = newAuthors.findIndex((a) => a.id === targetId)

    if (draggedIdx === -1 || targetIdx === -1) return

    // Swap
    ;[newAuthors[draggedIdx], newAuthors[targetIdx]] = [
      newAuthors[targetIdx],
      newAuthors[draggedIdx],
    ]

    // Reorder
    const reordered = newAuthors.map((a, idx) => ({
      ...a,
      contributionOrder: idx,
    }))

    onAuthorsChange(reordered)
    setDraggingId(null)
    toast.success('Author order updated')
  }

  const handleToggleCreditRole = (authorId: string, role: CreditRole) => {
    const author = authors.find((a) => a.id === authorId)
    if (!author) return

    const newRoles = author.creditRoles.includes(role)
      ? author.creditRoles.filter((r) => r !== role)
      : [...author.creditRoles, role]

    handleUpdateAuthor(authorId, { creditRoles: newRoles })
  }

  const handleSave = async () => {
    if (!onSave) return

    // Validation
    const unconfirmedCount = authors.filter((a) => !a.confirmedAt && a.userId).length
    if (unconfirmedCount > 0) {
      const confirm = window.confirm(
        `${unconfirmedCount} author(s) are unconfirmed. Continue saving?`
      )
      if (!confirm) return
    }

    setSaving(true)
    try {
      await onSave()
      toast.success('Authorship saved')
    } catch (err) {
      toast.error('Failed to save authorship')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-80 bg-slate-50 border-l border-slate-200 flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black text-[10px] uppercase tracking-[0.15em] text-slate-500">Authorship</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-slate-400 cursor-help hover:text-blue-600 transition-colors" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-xs">
                Drag to reorder authors. Assign CRediT roles to define contributions.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Unconfirmed warning */}
        {authors.some((a) => !a.confirmedAt && a.userId) && (
          <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700 font-medium">
            ⚠️ {authors.filter((a) => !a.confirmedAt && a.userId).length} author(s) unconfirmed
          </div>
        )}
      </div>

      {/* Author list */}
      <div className="flex-1 overflow-y-auto">
        {authors.length === 0 ? (
          <div className="text-center p-6">
            <p className="text-sm text-slate-500 mb-3">No authors yet</p>
            <Button
              size="sm"
              onClick={handleAddAuthor}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Author
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {sortedAuthors.map((author, idx) => (
              <div
                key={author.id}
                draggable
                onDragStart={() => handleDragStart(author.id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(author.id)}
                className={cn(
                  'p-4 transition-colors hover:bg-slate-100',
                  draggingId === author.id && 'bg-slate-200 opacity-50',
                  draggingId && draggingId !== author.id && 'hover:bg-slate-100'
                )}
              >
                {/* Author header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="cursor-move text-slate-400 mt-0.5">
                    <GripVertical className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {editingId === author.id ? (
                      <Input
                        type="text"
                        value={author.displayName}
                        onChange={(e) =>
                          handleUpdateAuthor(author.id, {
                            displayName: e.target.value,
                          })
                        }
                        placeholder="Author name"
                        autoFocus
                        className="text-sm mb-2 h-8 border-slate-300"
                      />
                    ) : (
                      <p
                        className="text-[13px] font-bold text-slate-900 truncate cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => setEditingId(author.id)}
                      >
                        {author.displayName || '(Unnamed)'}
                        {author.isCorresponding && (
                          <span className="ml-2 text-[9px] font-black bg-blue-600 text-white px-2 py-0.5 rounded inline uppercase tracking-wider">
                            Corresponding
                          </span>
                        )}
                      </p>
                    )}

                    {/* Confirmation status */}
                    {author.userId && (
                      <div className="flex items-center gap-1 mt-1">
                        {author.confirmedAt ? (
                          <div className="flex items-center gap-1 text-[11px] text-green-600 font-medium">
                            <Check className="h-3 w-3" />
                            Confirmed
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[11px] text-orange-600 font-medium">
                            <Clock className="h-3 w-3" />
                            Pending
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() =>
                        setExpandedId(
                          expandedId === author.id ? null : author.id
                        )
                      }
                    >
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform',
                          expandedId === author.id && 'rotate-180'
                        )}
                      />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteAuthor(author.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === author.id && (
                  <div className="space-y-3 ps-7 border-t border-slate-200 pt-3">
                    {/* Email */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1 uppercase tracking-wider">
                        Email
                      </label>
                      <Input
                        type="email"
                        value={author.email || ''}
                        onChange={(e) =>
                          handleUpdateAuthor(author.id, {
                            email: e.target.value,
                          })
                        }
                        placeholder="name@institution.com"
                        className="text-xs h-8 border-slate-300"
                      />
                    </div>

                    {/* ORCID */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1 uppercase tracking-wider">
                        ORCID
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={author.orcid || ''}
                          onChange={(e) =>
                            handleUpdateAuthor(author.id, {
                              orcid: e.target.value?.replace(/\D/g, ''),
                            })
                          }
                          placeholder="0000-0000-0000-0000"
                          className="text-xs h-8 font-mono border-slate-300"
                        />
                        {author.orcid && (
                          <a
                            href={`https://orcid.org/${author.orcid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 underline text-xs mt-1"
                          >
                            View
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Institution */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1 uppercase tracking-wider">
                        Institution
                      </label>
                      <Input
                        type="text"
                        value={author.institution || ''}
                        onChange={(e) =>
                          handleUpdateAuthor(author.id, {
                            institution: e.target.value,
                          })
                        }
                        placeholder="University or organization"
                        className="text-xs h-8 border-slate-300"
                      />
                    </div>

                    {/* Corresponding checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={author.isCorresponding}
                        onChange={(e) =>
                          handleUpdateAuthor(author.id, {
                            isCorresponding: e.target.checked,
                          })
                        }
                        className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600"
                      />
                      <span className="text-xs text-slate-600 font-medium">
                        Corresponding author
                      </span>
                    </label>

                    {/* CRediT roles */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-2 uppercase tracking-wider">
                        CRediT Roles
                      </label>
                      <div className="space-y-2">
                        {Object.entries(CREDIT_CATEGORIES).map(
                          ([category, roles]) => (
                            <div key={category}>
                              <p className="text-[10px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                                {category}
                              </p>
                              <div className="space-y-1 ps-2">
                                {roles.map((role) => (
                                  <label
                                    key={role}
                                    className="flex items-start gap-2 cursor-pointer text-[11px]"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={author.creditRoles.includes(role)}
                                      onChange={() =>
                                        handleToggleCreditRole(author.id, role)
                                      }
                                      className="h-3 w-3 mt-0.5 rounded border-slate-300 accent-blue-600"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="hover:underline text-slate-700 font-medium">
                                            {getCreditLabel(role)}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="left">
                                          <p className="text-xs max-w-xs">
                                            {getCreditDescription(role)}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Add button + Save */}
      <div className="shrink-0 p-4 border-t border-slate-200 space-y-2 bg-slate-50">
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddAuthor}
          className="w-full text-xs h-8 border-slate-300 text-slate-700 hover:bg-white"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Author
        </Button>
        {onSave && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || isLoading}
            className="w-full text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? 'Saving...' : 'Save Authorship'}
          </Button>
        )}
      </div>
    </div>
  )
}

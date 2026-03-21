"use client"

import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ShortcutOverlayProps {
  open: boolean
  onClose: () => void
}

const shortcuts = [
  {
    section: 'Global',
    items: [
      { keys: ['⌘', 'K'],   label: 'Open command palette' },
      { keys: ['⌘', '\\'],  label: 'Toggle sidebar' },
      { keys: ['?'],         label: 'Show keyboard shortcuts' },
    ],
  },
  {
    section: 'Navigation',
    items: [
      { keys: ['G', 'D'],   label: 'Go to Dashboard' },
      { keys: ['G', 'P'],   label: 'Go to Projects' },
      { keys: ['G', 'R'],   label: 'Go to Reviews' },
      { keys: ['G', 'N'],   label: 'Go to Notifications' },
    ],
  },
  {
    section: 'List views',
    items: [
      { keys: ['J'],         label: 'Move selection down' },
      { keys: ['K'],         label: 'Move selection up' },
      { keys: ['↵'],         label: 'Open selected item' },
      { keys: ['C'],         label: 'Create new item' },
      { keys: ['/'],         label: 'Focus search' },
      { keys: ['V'],         label: 'Cycle view mode' },
    ],
  },
  {
    section: 'Document editor',
    items: [
      { keys: ['⌘', 'S'],   label: 'Save version' },
      { keys: ['⌘', 'J'],   label: 'AI suggestion' },
      { keys: ['⌘', '↵'],   label: 'Submit for review' },
    ],
  },
]

export function ShortcutOverlay({ open, onClose }: ShortcutOverlayProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl px-4 animate-scale-in">
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Keyboard Shortcuts</h2>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Press <kbd className="font-mono bg-[var(--bg-inset)] px-1 rounded text-[10px]">ESC</kbd> to close</p>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Shortcut grid */}
          <div className="grid grid-cols-2 gap-6 p-6">
            {shortcuts.map(section => (
              <div key={section.section}>
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)] mb-3">
                  {section.section}
                </h3>
                <div className="space-y-2">
                  {section.items.map(item => (
                    <div key={item.label} className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[var(--text-secondary)]">{item.label}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {item.keys.map((k, i) => (
                          <kbd
                            key={i}
                            className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-inset)] border border-[var(--border-default)] rounded px-1.5 py-0.5 min-w-[1.5rem] text-center"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

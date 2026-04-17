'use client'

import type { SaveState } from '@/hooks/useDocumentAutoSave'

function formatRelative(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

export function SaveStateIndicator({
  state,
  lastSaved,
  onRetry,
}: {
  state: SaveState
  lastSaved: Date | null
  onRetry?: () => void
}) {
  const config = {
    saved: {
      dot: '#16a34a',
      text: lastSaved ? `Saved ${formatRelative(lastSaved)}` : 'Saved',
      color: '#166534',
    },
    saving: {
      dot: '#003d9b',
      text: 'Saving...',
      color: '#003d9b',
    },
    queued: {
      dot: '#b45309',
      text: 'Saved locally · will sync',
      color: '#92400e',
    },
    unsaved: {
      dot: '#b45309',
      text: 'Unsaved changes',
      color: '#92400e',
    },
    error: {
      dot: '#ba1a1a',
      text: 'Save failed',
      color: '#991b1b',
    },
  }[state]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: config.dot,
          animation: state === 'saving' ? 'pulse 1s infinite' : 'none',
        }}
      />
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: config.color }}>
        {config.text}
      </span>
      {state === 'error' && onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontSize: '11px',
            color: '#003d9b',
            fontWeight: 600,
            padding: '0 4px',
          }}
        >
          Retry
        </button>
      )}
    </div>
  )
}

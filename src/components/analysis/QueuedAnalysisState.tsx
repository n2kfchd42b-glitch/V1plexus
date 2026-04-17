'use client'

function formatRelative(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

export function QueuedAnalysisState({
  job_id,
  analysis_type,
  queued_at,
  isOnline,
  onCancel,
}: {
  job_id: string
  analysis_type: string
  queued_at: string
  isOnline: boolean
  onCancel?: () => void
}) {
  return (
    <div style={{
      background: 'rgba(180,83,9,0.06)',
      borderRadius: '16px',
      padding: '24px 28px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>

        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary, #1a1a1a)', marginBottom: '6px' }}>
            Analysis queued
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--text-secondary, #5a5a6a)', lineHeight: 1.5 }}>
            {isOnline
              ? 'This analysis will retry shortly.'
              : 'You are offline. This analysis will run automatically when your connection returns.'}
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '10px 12px',
        background: 'rgba(180,83,9,0.04)',
        borderRadius: '8px',
        border: '1px solid rgba(180,83,9,0.12)',
      }}>
        {[
          ['Analysis type', analysis_type.replace(/_/g, ' ')],
          ['Job ID', job_id.slice(0, 8)],
          ['Queued', formatRelative(queued_at)],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', gap: '8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>
            <span style={{ color: 'var(--text-tertiary, #8a8a9a)', minWidth: '100px' }}>{label}</span>
            <span style={{ color: 'var(--text-secondary, #5a5a6a)' }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#b45309',
              opacity: 0.4,
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            alignSelf: 'flex-start',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontSize: '12px',
            color: 'var(--text-secondary, #5a5a6a)',
            padding: '0',
            textDecoration: 'underline',
          }}
        >
          Cancel
        </button>
      )}
    </div>
  )
}

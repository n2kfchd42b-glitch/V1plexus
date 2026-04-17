'use client'

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f7f9fb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-inter, Inter, sans-serif)',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-manrope, Manrope, sans-serif)',
            fontSize: 20,
            fontWeight: 800,
            color: '#003d9b',
            letterSpacing: '-0.03em',
            marginBottom: 40,
          }}
        >
          PLEXUS
        </div>

        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: '#f2f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#737685"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-manrope, Manrope, sans-serif)',
            fontSize: 22,
            fontWeight: 700,
            color: '#191c1e',
            marginBottom: 10,
            letterSpacing: '-0.02em',
          }}
        >
          You are offline
        </h1>

        <p
          style={{
            fontSize: 14,
            color: '#434654',
            lineHeight: 1.7,
            marginBottom: 32,
          }}
        >
          This page is not available offline. Your previously visited pages and cached data are
          still accessible.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => window.history.back()}
            style={{
              background: 'linear-gradient(135deg, #003d9b, #0052cc)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              padding: '12px 24px',
              fontFamily: 'var(--font-manrope, Manrope, sans-serif)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            Go Back
          </button>

          <button
            onClick={() => (window.location.href = '/')}
            style={{
              background: '#f2f4f6',
              color: '#434654',
              border: 'none',
              borderRadius: 10,
              padding: '12px 24px',
              fontFamily: 'var(--font-manrope, Manrope, sans-serif)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go to Dashboard
          </button>
        </div>

        <p
          style={{
            marginTop: 32,
            fontSize: 11,
            color: '#737685',
            fontFamily: 'var(--font-geist-mono, monospace)',
          }}
        >
          plexus.science
        </p>
      </div>
    </div>
  )
}

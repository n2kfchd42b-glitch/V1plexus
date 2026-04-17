'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('plexus-install-dismissed')) return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    function handleInstallPrompt(e: Event) {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
      // 30-second delay — showing immediately is the top reason users dismiss PWA prompts
      setTimeout(() => setVisible(true), 30_000)
    }

    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
  }, [])

  async function handleInstall() {
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === 'accepted') setVisible(false)
  }

  function handleDismiss() {
    localStorage.setItem('plexus-install-dismissed', 'true')
    setVisible(false)
  }

  if (!visible || !installEvent) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        background: '#ffffff',
        borderRadius: 16,
        padding: '20px 24px',
        boxShadow: '0 20px 60px rgba(0,24,72,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        maxWidth: 420,
        width: 'calc(100vw - 48px)',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #003d9b, #0052cc)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-manrope, Manrope, sans-serif)',
            fontSize: 14,
            fontWeight: 800,
            color: 'white',
          }}
        >
          PX
        </span>
      </div>

      <div style={{ flex: 1 }}>
        <p
          style={{
            fontFamily: 'var(--font-manrope, Manrope, sans-serif)',
            fontSize: 13,
            fontWeight: 700,
            color: '#191c1e',
            margin: '0 0 2px',
          }}
        >
          Install PLEXUS
        </p>
        <p
          style={{
            fontFamily: 'var(--font-inter, Inter, sans-serif)',
            fontSize: 11,
            color: '#434654',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Add to your home screen for offline access and faster loading
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <button
          onClick={handleInstall}
          style={{
            background: 'linear-gradient(135deg, #003d9b, #0052cc)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '7px 14px',
            fontFamily: 'var(--font-manrope, Manrope, sans-serif)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            color: '#737685',
            border: 'none',
            padding: 4,
            fontFamily: 'var(--font-inter, Inter, sans-serif)',
            fontSize: 11,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          Not now
        </button>
      </div>
    </div>
  )
}

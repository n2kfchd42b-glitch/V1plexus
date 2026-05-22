'use client'

import { useState, useRef } from 'react'
import { Shield, KeyRound, Eye, EyeOff, Loader2, X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { StoredSessionKey } from '@/lib/ledger/keyManager'

interface LedgerKeyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'setup' | 'unlock'
  projectId: string
  onSetup?: (passphrase: string, ttlHours: number) => Promise<void>
  sessionKey?: StoredSessionKey | null
  busy?: boolean
  error?: string | null
}

const TTL_OPTIONS = [
  { label: '4 hours', value: 4 },
  { label: '8 hours', value: 8 },
  { label: '24 hours', value: 24 },
  { label: '7 days', value: 168 },
]

export function LedgerKeyModal({
  open,
  onOpenChange,
  mode,
  onSetup,
  sessionKey,
  busy = false,
  error = null,
}: LedgerKeyModalProps) {
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [ttlHours, setTtlHours] = useState(8)
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setPassphrase('')
    setConfirm('')
    setShowPass(false)
    setLocalError(null)
  }

  function handleClose() {
    if (busy) return
    reset()
    onOpenChange(false)
  }

  async function handleSubmit() {
    setLocalError(null)
    if (mode === 'setup') {
      if (passphrase.length < 8) {
        setLocalError('Passphrase must be at least 8 characters.')
        return
      }
      if (passphrase !== confirm) {
        setLocalError('Passphrases do not match.')
        return
      }
    }
    if (!passphrase) {
      setLocalError('Passphrase is required.')
      return
    }
    try {
      await onSetup?.(passphrase, ttlHours)
      reset()
      onOpenChange(false)
    } catch {
      // error surfaced via props.error
    }
  }

  const displayError = localError ?? error

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 border border-green-200">
              <Shield className="h-4 w-4 text-green-600" />
            </div>
            <DialogTitle className="text-base">
              {mode === 'setup' ? 'Activate Ledger Key' : 'Unlock Ledger Key'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {mode === 'setup'
              ? 'Your passphrase encrypts your Ed25519 signing key. It is never stored — only you can sign your research actions.'
              : 'Enter your passphrase to unlock your session signing key.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          {/* Active key info */}
          {mode === 'unlock' && sessionKey && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
              Key expires {new Date(sessionKey.expires_at).toLocaleString()}
            </div>
          )}

          {/* Passphrase input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-primary">
              {mode === 'setup' ? 'Choose a passphrase' : 'Your passphrase'}
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPass ? 'text' : 'password'}
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !busy && handleSubmit()}
                placeholder={mode === 'setup' ? 'At least 8 characters' : 'Enter your passphrase'}
                disabled={busy}
                className="w-full h-9 px-3 pr-9 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
              >
                {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Confirm passphrase (setup only) */}
          {mode === 'setup' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-primary">Confirm passphrase</label>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !busy && handleSubmit()}
                placeholder="Re-enter passphrase"
                disabled={busy}
                className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
          )}

          {/* TTL selector (setup only) */}
          {mode === 'setup' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-primary">Session duration</label>
              <div className="flex gap-1.5 flex-wrap">
                {TTL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTtlHours(opt.value)}
                    disabled={busy}
                    className={cn(
                      'px-2.5 py-1 rounded text-[11px] font-medium border transition-colors',
                      ttlHours === opt.value
                        ? 'bg-accent-blue-subtle text-accent-blue border-blue-200'
                        : 'bg-bg-surface text-text-secondary border-border-default hover:bg-bg-surface-hover'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {displayError && (
            <p className="text-xs text-destructive">{displayError}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={busy}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={busy || !passphrase}
              className="flex-1"
            >
              {busy
                ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                : <KeyRound className="h-3.5 w-3.5 mr-1.5" />
              }
              {mode === 'setup' ? 'Activate Key' : 'Unlock'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

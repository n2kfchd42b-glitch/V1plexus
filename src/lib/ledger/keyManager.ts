/**
 * Ledger Key Manager
 *
 * Manages Ed25519 session keys for researcher-signed ledger events.
 * Encrypted key material (never raw private key) is stored in sessionStorage
 * and cleared on expiry or explicit logout.
 *
 * Crypto operations (scrypt + XSalsa20-Poly1305 decrypt) run server-side
 * in the Next.js API route — see /api/ledger/event/route.ts.
 */

const STORAGE_KEY = 'plexus_ledger_key'

export interface StoredSessionKey {
  session_key_id: string
  encrypted_private_key_b64: string
  salt_b64: string
  public_key: string
  project_id: string
  expires_at: string
}

export interface LedgerKeyMaterial {
  sessionKeyId: string
  encryptedPrivateKeyB64: string
  saltB64: string
  projectId: string
  expiresAt: Date
}

// ── Storage helpers ───────────────────────────────────────────────────────────

export function saveSessionKey(raw: StoredSessionKey): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(raw))
}

export function loadSessionKey(projectId?: string): StoredSessionKey | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredSessionKey
    if (new Date(parsed.expires_at) < new Date()) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    if (projectId && parsed.project_id !== projectId) return null
    return parsed
  } catch {
    return null
  }
}

export function clearSessionKey(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(STORAGE_KEY)
}

export function isSessionKeyValid(projectId: string): boolean {
  return loadSessionKey(projectId) !== null
}

// ── API helpers ───────────────────────────────────────────────────────────────

interface GenerateKeyOptions {
  projectId: string
  passphrase: string
  ttlHours?: number
}

interface GenerateKeyResponse {
  session_key_id: string
  encrypted_private_key: string
  salt: string
  public_key: string
  expires_at: string
}

/**
 * Generate a new Ed25519 session key for a project.
 * Calls /api/ledger/session-key (Next.js → Python).
 * Stores encrypted key material in sessionStorage.
 */
export async function generateSessionKey(opts: GenerateKeyOptions): Promise<StoredSessionKey> {
  const response = await fetch('/api/ledger/session-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: opts.projectId,
      passphrase: opts.passphrase,
      ttl_hours: opts.ttlHours ?? 8,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { detail?: string }
    throw new Error(err.detail ?? `Session key generation failed (${response.status})`)
  }

  const data = await response.json() as GenerateKeyResponse

  const stored: StoredSessionKey = {
    session_key_id: data.session_key_id,
    encrypted_private_key_b64: data.encrypted_private_key,
    salt_b64: data.salt,
    public_key: data.public_key,
    project_id: opts.projectId,
    expires_at: data.expires_at,
  }

  saveSessionKey(stored)
  return stored
}

// ── Ledger event helper ───────────────────────────────────────────────────────

interface WriteEventOptions {
  projectId: string
  eventType: string
  payload: Record<string, unknown>
  actorId: string
  actorRole: string
  passphrase: string
}

interface LedgerEventResult {
  id: string
  sequence_number: number
  event_hash: string
  timestamp: string
}

/**
 * Append a researcher-signed event to the project ledger.
 * Decryption of the private key happens server-side in /api/ledger/event.
 */
export async function writeLedgerEvent(opts: WriteEventOptions): Promise<LedgerEventResult> {
  const stored = loadSessionKey(opts.projectId)
  if (!stored) {
    throw new Error('No active session key for this project. Please set up your ledger key first.')
  }

  const response = await fetch('/api/ledger/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: opts.projectId,
      event_type: opts.eventType,
      payload: opts.payload,
      actor_id: opts.actorId,
      actor_role: opts.actorRole,
      session_key_id: stored.session_key_id,
      encrypted_private_key_b64: stored.encrypted_private_key_b64,
      salt_b64: stored.salt_b64,
      passphrase: opts.passphrase,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { detail?: string }
    throw new Error(err.detail ?? `Ledger event write failed (${response.status})`)
  }

  return response.json()
}

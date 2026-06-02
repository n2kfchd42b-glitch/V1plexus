/**
 * POST /api/ledger/event
 * Proxy to Python FastAPI POST /api/ledger/event
 *
 * The client sends:
 *   { project_id, event_type, payload, actor_id, actor_role,
 *     session_key_id, encrypted_private_key_b64, salt_b64, passphrase }
 *
 * This route:
 *   1. Uses Node.js crypto.scryptSync (INTERACTIVE params) to re-derive the
 *      symmetric key from the passphrase + stored salt.
 *   2. Decrypts the Ed25519 private key using tweetnacl SecretBox
 *      (XSalsa20-Poly1305, matching PyNaCl SecretBox format).
 *   3. Forwards session_key_hex (but NOT the passphrase or encrypted key)
 *      to the Python analytics service for in-memory signing.
 *
 * Neither the passphrase nor the raw private key is ever written to any store.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ANALYTICS_ENABLED } from '@/lib/flags'
import { getAnalyticsBaseUrl } from '@/lib/analyticsService'
import { createClient, getAccessTokenFromRequest } from '@/lib/supabase/server'
import { scryptSync } from 'crypto'
import nacl from 'tweetnacl'

interface EventRequestBody {
  project_id: string
  event_type: string
  payload: Record<string, unknown>
  actor_id: string
  actor_role: string
  session_key_id: string
  encrypted_private_key_b64: string
  salt_b64: string
  passphrase: string
}

export async function POST(request: NextRequest) {
  if (!ANALYTICS_ENABLED) {
    return Response.json({ unavailable: true, error: 'Advanced analytics service is not enabled.' }, { status: 503 })
  }
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = getAccessTokenFromRequest(request)
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: EventRequestBody = await request.json()
    const {
      project_id, event_type, payload, actor_id, actor_role, session_key_id,
      encrypted_private_key_b64, salt_b64, passphrase,
    } = body

    if (!encrypted_private_key_b64 || !salt_b64 || !passphrase) {
      return NextResponse.json(
        { error: 'encrypted_private_key_b64, salt_b64, and passphrase are required' },
        { status: 400 }
      )
    }

    // Enforce actor_id matches the authenticated user
    if (actor_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 1. Decode the stored encrypted private key and salt
    const encryptedBytes = Buffer.from(encrypted_private_key_b64, 'base64')
    const saltBytes = Buffer.from(salt_b64, 'base64')

    // 2. Re-derive symmetric key using scrypt INTERACTIVE params (matching Python)
    //    n=2^14=16384, r=8, p=1, keylen=32
    let symmetricKey: Buffer
    try {
      symmetricKey = scryptSync(
        Buffer.from(passphrase, 'utf8'),
        saltBytes,
        32,
        { N: 16384, r: 8, p: 1 },
      )
    } catch {
      return NextResponse.json({ error: 'Key derivation failed' }, { status: 422 })
    }

    // 3. Decrypt using tweetnacl secretbox (XSalsa20-Poly1305)
    //    PyNaCl SecretBox.encrypt() prepends a 24-byte nonce to the ciphertext.
    //    tweetnacl.secretbox.open() expects: (ciphertext_with_nonce, nonce, key)
    //    but its format uses box.open(box_output, nonce, key) where the box_output
    //    does NOT include the nonce.  PyNaCl does include the nonce, so we split.
    if (encryptedBytes.length < nacl.secretbox.nonceLength + nacl.secretbox.overheadLength) {
      return NextResponse.json({ error: 'Invalid encrypted key format' }, { status: 422 })
    }

    const nonce = encryptedBytes.subarray(0, nacl.secretbox.nonceLength)
    const ciphertext = encryptedBytes.subarray(nacl.secretbox.nonceLength)

    const privateKeyBytes = nacl.secretbox.open(
      new Uint8Array(ciphertext),
      new Uint8Array(nonce),
      new Uint8Array(symmetricKey),
    )

    if (!privateKeyBytes) {
      return NextResponse.json(
        { error: 'Decryption failed — wrong passphrase or corrupted key' },
        { status: 422 }
      )
    }

    if (privateKeyBytes.length !== 32) {
      return NextResponse.json({ error: 'Unexpected private key length' }, { status: 422 })
    }

    const sessionKeyHex = Buffer.from(privateKeyBytes).toString('hex')

    // 4. Forward to Python for in-memory signing (private key used once, discarded)
    const analyticsUrl = getAnalyticsBaseUrl()

    const response = await fetch(`${analyticsUrl}/api/ledger/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        project_id,
        event_type,
        payload,
        actor_id,
        actor_role,
        session_key_id,
        session_key_hex: sessionKeyHex,
      }),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    console.error('[POST /api/ledger/event]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

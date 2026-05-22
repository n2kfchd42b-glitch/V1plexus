/**
 * POST /api/ledger/session-key
 * Proxy to Python FastAPI POST /api/ledger/session-key
 *
 * Generates an Ed25519 session keypair server-side. The Python service:
 *   - Stores only the public key in ledger_session_keys
 *   - Returns encrypted_private_key + salt to the caller (client stores locally)
 *   - Raw private key is never persisted anywhere
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, getAccessTokenFromRequest } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
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

    const body = await request.json()

    let analyticsUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8000'
    if (analyticsUrl && !analyticsUrl.startsWith('http')) analyticsUrl = `https://${analyticsUrl}`

    const response = await fetch(`${analyticsUrl}/api/ledger/session-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    console.error('[POST /api/ledger/session-key]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

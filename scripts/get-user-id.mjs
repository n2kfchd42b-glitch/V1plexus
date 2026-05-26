#!/usr/bin/env node
/**
 * Look up a Supabase auth user's UUID by email.
 *
 *   node scripts/get-user-id.mjs you@example.com
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Queries the `profiles` table (whose id is the auth.users.id).
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')

function loadEnv(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return {}
  }
  const out = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let val = m[2]
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    out[m[1]] = val
  }
  return out
}

const env = { ...loadEnv(envPath), ...process.env }
const email = process.argv[2]?.trim().toLowerCase()

if (!email) {
  console.error('Usage: node scripts/get-user-id.mjs <email>')
  process.exit(1)
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data, error } = await supabase
  .from('profiles')
  .select('id, email, full_name')
  .ilike('email', email)
  .maybeSingle()

if (error) {
  console.error('Lookup failed:', error.message)
  process.exit(1)
}

if (!data) {
  console.error(`No profile found for ${email}`)
  process.exit(1)
}

console.log(`${data.id}    (${data.email}${data.full_name ? ` — ${data.full_name}` : ''})`)

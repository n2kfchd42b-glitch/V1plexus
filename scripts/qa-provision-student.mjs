// Provision a pre-confirmed QA student account via the Supabase admin API
// (service-role key from .env.local). Equivalent to self-registering, minus the
// email-confirmation hop we can't complete headlessly. Writes the creds to
// /tmp/qa-student.json for the Playwright walkthrough; verifies login works.
//
// Run: node scripts/qa-provision-student.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const grab = k => {
  let v = (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim()
  if (v && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) v = v.slice(1, -1)
  return v
}

const URL = grab('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE = grab('SUPABASE_SERVICE_ROLE_KEY')
const ANON = grab('NEXT_PUBLIC_SUPABASE_ANON_KEY')
if (!URL || !SERVICE || !ANON) { console.error('Missing Supabase env'); process.exit(1) }

const stamp = Date.now()
const email = `qa.student.${stamp}@example.com`
const password = `QaStudent!${stamp}`
const fullName = 'QA Student (test)'

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

const { data, error } = await admin.auth.admin.createUser({
  email, password, email_confirm: true, user_metadata: { full_name: fullName },
})
if (error) { console.error('createUser failed:', error.message); process.exit(1) }
console.log('• created confirmed student:', email, 'id=', data.user?.id)

// verify login works through the normal anon path
const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
const { error: signInErr } = await anon.auth.signInWithPassword({ email, password })
if (signInErr) { console.error('login verify failed:', signInErr.message); process.exit(1) }
console.log('• login verified ✓')

writeFileSync('/tmp/qa-student.json', JSON.stringify({ email, password, userId: data.user?.id }, null, 2))
console.log('• creds written to /tmp/qa-student.json')

#!/usr/bin/env node
/**
 * End-to-end smoke test for the provision_institution RPC (migration
 * 20260528000006). Verifies:
 *
 *   1. Happy path — RPC creates the institution + workspace + invitation
 *      and returns their ids; all three rows are present.
 *   2. Atomicity — when a downstream step fails (we collide the workspace
 *      slug with a row that already exists), the institution insert that
 *      happened earlier in the same transaction is rolled back. This is
 *      the whole point of moving the 3 writes into an RPC, so it deserves
 *      explicit verification.
 *
 * The script always cleans up after itself (test-marker prefix on the
 * institution name + workspace slug + invitation email). Re-running it is
 * safe even if a prior run died mid-cleanup.
 *
 *   node scripts/smoke-provision-institution.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Requires Seth's platform-admin UUID from PLATFORM_ADMIN_USER_IDS in the
 * same file (uses the first id as p_actor_id).
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')

function loadEnv(path) {
  let raw
  try { raw = readFileSync(path, 'utf8') } catch { return {} }
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
const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const platformAdminIds = (env.PLATFORM_ADMIN_USER_IDS ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean)

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
if (platformAdminIds.length === 0) {
  console.error('Missing PLATFORM_ADMIN_USER_IDS in .env.local (need at least one UUID for p_actor_id)')
  process.exit(1)
}

const svc = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const actorId = platformAdminIds[0]

// Test-marker prefix makes cleanup queries unambiguous.
const TAG = 'smoke-prov'
const ts = Date.now()
const happy = {
  name:        `${TAG} Happy ${ts}`,
  slug:        `${TAG}-happy-${ts}`,
  adminEmail:  `${TAG}-happy-${ts}@example.test`,
  token:       randomUUID().replace(/-/g, ''),
}
// For the atomicity test we want step 1 (institutions INSERT) to succeed
// and step 2 (workspaces INSERT) to fail — that's the orphan-creating
// scenario the RPC is designed to prevent. Use a fresh institution slug
// (no collision) but reuse the happy-path workspace slug to trip the
// workspaces.slug UQ on the second insert.
const atomic = {
  name:        `${TAG} Atomic ${ts}`,
  slug:        `${TAG}-atomic-${ts}`,         // fresh — institutions.slug clean
  workspaceSlug: happy.slug,                  // collides with workspaces.slug from happy
  adminEmail:  `${TAG}-atomic-${ts}@example.test`,
  token:       randomUUID().replace(/-/g, ''),
}

const created = { institutionIds: [], workspaceIds: [] }

function logStep(s) { process.stdout.write(`\n→ ${s}\n`) }
function logOk(s)   { process.stdout.write(`  ✓ ${s}\n`) }
function logFail(s) { process.stdout.write(`  ✗ ${s}\n`) }

async function callRpc(args) {
  return svc.rpc('provision_institution', {
    p_actor_id:           actorId,
    p_institution_name:   args.name,
    p_institution_slug:   args.slug,
    p_short_name:         '',
    p_type:               'university',
    p_country:            'Greenland',
    p_email_domain:       '',
    p_auto_link_domains:  [],
    p_workspace_slug:     args.workspaceSlug ?? args.slug,
    p_admin_email:        args.adminEmail,
    p_invite_token:       args.token,
  })
}

async function cleanup() {
  // Delete by tag, broader than `created` set, in case earlier runs leaked rows.
  // Order matters: workspace_invitations → workspaces → institutions (FK chain).
  await svc.from('workspace_invitations').delete().like('email', `${TAG}-%`)
  await svc.from('workspaces').delete().like('slug', `${TAG}-%`)
  await svc.from('institutions').delete().like('name', `${TAG} %`)
}

let failures = 0

try {
  logStep('Pre-cleanup (in case a prior run died mid-test)')
  await cleanup()
  logOk('Test rows from any prior run removed')

  // ── 1. Happy path ──────────────────────────────────────────────────────────
  logStep('Happy path: provision_institution RPC with fresh inputs')

  const { data, error } = await callRpc(happy)
  if (error) {
    logFail(`RPC errored: ${error.message}`)
    failures += 1
  } else {
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.institution_id || !row?.workspace_id) {
      logFail(`RPC returned malformed payload: ${JSON.stringify(data)}`)
      failures += 1
    } else {
      created.institutionIds.push(row.institution_id)
      created.workspaceIds.push(row.workspace_id)
      logOk(`RPC returned institution_id=${row.institution_id} workspace_id=${row.workspace_id}`)

      // Verify all three rows exist.
      const [{ data: inst }, { data: ws }, { data: inv }] = await Promise.all([
        svc.from('institutions').select('id, name, provisioned_by, verification_tier').eq('id', row.institution_id).maybeSingle(),
        svc.from('workspaces').select('id, slug, type, institution_id').eq('id', row.workspace_id).maybeSingle(),
        svc.from('workspace_invitations').select('id, email, role, status, token').eq('workspace_id', row.workspace_id).eq('email', happy.adminEmail).maybeSingle(),
      ])

      if (inst?.name === happy.name && inst?.provisioned_by === actorId && inst?.verification_tier === 'SELF_ATTESTED') {
        logOk(`institutions row OK (name="${inst.name}" tier=${inst.verification_tier})`)
      } else {
        logFail(`institutions row missing or wrong: ${JSON.stringify(inst)}`)
        failures += 1
      }

      if (ws?.slug === happy.slug && ws?.type === 'institutional' && ws?.institution_id === row.institution_id) {
        logOk(`workspaces row OK (slug=${ws.slug})`)
      } else {
        logFail(`workspaces row missing or wrong: ${JSON.stringify(ws)}`)
        failures += 1
      }

      if (inv?.email === happy.adminEmail && inv?.role === 'admin' && inv?.status === 'pending' && inv?.token === happy.token) {
        logOk(`workspace_invitations row OK (email=${inv.email} role=admin status=pending)`)
      } else {
        logFail(`workspace_invitations row missing or wrong: ${JSON.stringify(inv)}`)
        failures += 1
      }
    }
  }

  // ── 2. Atomicity: institution insert succeeds, workspace insert fails ────
  // Step 1 (institutions) gets a fresh slug, so it would commit on its own.
  // Step 2 (workspaces) reuses the happy-path workspace slug, which is
  // taken — Postgres raises 23505. The whole RPC transaction must roll back,
  // leaving no orphan institution row behind. This is the bug the RPC was
  // introduced to fix; the old sequential code would orphan the institution.
  logStep('Atomicity: institution insert OK, workspace UQ collision should roll back')

  // Snapshot the institutions count for the test name so we can verify no
  // orphan was committed if step 2 of the RPC failed.
  const { data: beforeRows } = await svc
    .from('institutions').select('id').like('name', `${TAG} Atomic %`)
  const beforeCount = beforeRows?.length ?? 0

  const { data: atomicData, error: atomicErr } = await callRpc(atomic)

  if (!atomicErr) {
    logFail(`RPC unexpectedly succeeded with atomic inputs: ${JSON.stringify(atomicData)}`)
    failures += 1
  } else if (atomicErr.code !== '23505' && !atomicErr.message.toLowerCase().includes('duplicate')) {
    logFail(`RPC failed with unexpected error: ${atomicErr.code} ${atomicErr.message}`)
    failures += 1
  } else {
    logOk(`RPC rejected with expected UQ collision (${atomicErr.code} ${atomicErr.message.slice(0, 80)})`)

    // The whole transaction should have rolled back, so no `${TAG} Atomic %`
    // institution row should exist.
    const { data: afterRows } = await svc
      .from('institutions').select('id, name').like('name', `${TAG} Atomic %`)
    const afterCount = afterRows?.length ?? 0
    if (afterCount === beforeCount) {
      logOk(`No orphan institutions row created (count ${beforeCount} → ${afterCount}) — transaction rolled back`)
    } else {
      logFail(`Orphan institutions row(s) left behind: ${JSON.stringify(afterRows)}`)
      failures += 1
      for (const r of afterRows ?? []) created.institutionIds.push(r.id)
    }
  }
} finally {
  logStep('Cleanup')
  await cleanup()
  logOk('Test rows removed')
}

if (failures > 0) {
  console.error(`\n✗ Smoke test failed: ${failures} issue(s)`)
  process.exit(1)
}
console.log('\n✓ Smoke test passed: provision_institution is atomic end-to-end.')

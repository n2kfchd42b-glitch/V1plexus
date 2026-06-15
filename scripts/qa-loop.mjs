// Closes the gap from the platform walkthrough: verifies the STUDENT create
// side of the loop (thesis wizard -> chapters -> supervisor-invite UI), which
// was previously blocked by the onboarding gate. Marks onboarding complete via
// the admin API (test setup), then drives the real UI patiently (the dev server
// cold-compiles each route, so waits are generous).
//
// Run: node scripts/qa-loop.mjs

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3001'
const OUT = '/tmp/qa-loop'; mkdirSync(OUT, { recursive: true })
const env = readFileSync('.env.local', 'utf8')
const grab = k => { let v = (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim(); if (v && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) v = v.slice(1, -1); return v }
const STU = JSON.parse(readFileSync('/tmp/qa-student.json', 'utf8'))

// ── mark onboarding complete via admin (skip the individual-setup gate) ──
const admin = createClient(grab('NEXT_PUBLIC_SUPABASE_URL'), grab('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
{
  const { error } = await admin.from('profiles').update({ workspace_setup_completed: true, onboarding_completed: true }).eq('id', STU.userId)
  console.log('• onboarding flag update:', error ? 'ERR ' + error.message : 'ok')
}

const log = (...a) => console.log('•', ...a)
let n = 0
const shot = async (page, name) => { const f = `${OUT}/${String(++n).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: f }).catch(() => {}); log('shot:', f) }
const errs = []

const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message))

const clickNext = async () => {
  const b = page.getByRole('button', { name: /^Next$/ })
  await b.first().click({ timeout: 8000 }); await page.waitForTimeout(800)
}

try {
  // login (patient: cold compile + post-login role queries)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('#email').waitFor({ state: 'visible' }); await page.waitForTimeout(900)
  await page.fill('#email', STU.email); await page.fill('#password', STU.password)
  if ((await page.locator('#email').inputValue()) !== STU.email) { await page.waitForTimeout(600); await page.fill('#email', STU.email); await page.fill('#password', STU.password) }
  await page.click('button[type=submit]')
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 45000 }).catch(() => {})
  await page.waitForTimeout(2500)
  log('after login:', page.url()); await shot(page, 'after-login')

  // thesis wizard
  await page.goto(`${BASE}/projects/new-thesis`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[placeholder*="Malaria"]', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(800); await shot(page, 'wizard-step0')
  await page.fill('input[placeholder*="Malaria"]', 'QA Thesis — Malaria Prevalence in Northern Ghana').catch(() => {})
  await clickNext()
  await shot(page, 'wizard-step1')
  await page.waitForTimeout(100) // (fix verify) intentionally NOT clicking a degree — accept default MSc
  await page.selectOption('select', { label: 'Epidemiology' }).catch(() => log('skip program'))
  await page.waitForTimeout(400); await shot(page, 'wizard-step1-filled')
  await clickNext(); await shot(page, 'wizard-step2-chapters')
  await clickNext(); await shot(page, 'wizard-step3-committee')
  await page.getByRole('button', { name: /Create Thesis Project/ }).click({ timeout: 8000 }).catch(() => log('skip create'))

  await page.waitForURL(/\/chapters/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)
  log('after create:', page.url()); await shot(page, 'chapters')

  const pid = (page.url().match(/\/projects\/([0-9a-f-]{36})/) || [])[1]
  log('project id:', pid || 'NONE')
  if (pid) {
    await page.goto(`${BASE}/projects/${pid}/setup`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000); await shot(page, 'setup-supervisor-invite')
    // open the "add supervisor" finder to confirm the entry point works
    await page.getByRole('button', { name: /supervisor|add/i }).first().click({ timeout: 6000 }).catch(() => log('skip open finder'))
    await page.waitForTimeout(1500); await shot(page, 'supervisor-finder')
  }
} catch (e) { log('FATAL:', e.message); await shot(page, 'fatal') }

console.log('\n=== console/page errors ===')
console.log(errs.length ? [...new Set(errs)].slice(0, 25).join('\n') : '(none)')
await browser.close()

// Platform MVP walkthrough: drives the student thesis-setup loop and the
// supervisor side, screenshotting every step for both a function check and a
// design/friction critique. Best-effort + try/catch so it always completes and
// produces evidence. Captures console/page errors per journey.
//
// Run: node scripts/qa-platform.mjs   (dev server on :3001; student provisioned)

import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3001'
const OUT = '/tmp/qa-platform'
mkdirSync(OUT, { recursive: true })

const env = readFileSync('.env.local', 'utf8')
const grab = k => {
  let v = (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim()
  if (v && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) v = v.slice(1, -1)
  return v
}
const SUP = { email: grab('TEST_USER_EMAIL'), pw: grab('TEST_USER_PASSWORD') }
const STU = JSON.parse(readFileSync('/tmp/qa-student.json', 'utf8'))

const log = (...a) => console.log('•', ...a)
let n = 0
async function shot(page, name) {
  const f = `${OUT}/${String(++n).padStart(2, '0')}-${name}.png`
  await page.screenshot({ path: f }).catch(() => {})
  log('shot:', f)
}
async function tryClick(page, loc, label, t = 6000) {
  try { await loc.first().click({ timeout: t }); log('click:', label); return true }
  catch { log('skip:', label); return false }
}
async function login(page, email, pw) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  const emailEl = page.locator('#email')
  await emailEl.waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(900) // let the Suspense'd form hydrate before filling
  await emailEl.fill(email)
  await page.locator('#password').fill(pw)
  if ((await emailEl.inputValue()) !== email) { // hydration race guard
    await page.waitForTimeout(600)
    await emailEl.fill(email)
    await page.locator('#password').fill(pw)
  }
  await Promise.all([
    page.waitForURL(u => !u.toString().includes('/login'), { timeout: 30000 }).catch(() => {}),
    page.click('button[type=submit]'),
  ])
  await page.waitForTimeout(2000)
}
function wireErrors(page, bucket) {
  page.on('console', m => { if (m.type() === 'error') bucket.push(m.text()) })
  page.on('pageerror', e => bucket.push('PAGEERROR ' + e.message))
}

const browser = await chromium.launch({ headless: true })
const errStudent = [], errSup = []

// ─────────── STUDENT JOURNEY ───────────
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage(); wireErrors(page, errStudent)

  await login(page, STU.email, STU.password)
  log('student landed on', page.url()); await shot(page, 'student-landing')

  await page.goto(`${BASE}/projects`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200)
  await shot(page, 'student-projects')

  // Thesis creation wizard
  await page.goto(`${BASE}/projects/new-thesis`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200)
  await shot(page, 'wizard-step0-basic')
  await page.fill('input[placeholder*="Malaria"]', 'QA Thesis — Malaria Prevalence in Northern Ghana').catch(() => {})
  await page.fill('textarea[placeholder*="description" i]', 'Automated QA walkthrough thesis.').catch(() => {})
  await tryClick(page, page.getByRole('button', { name: /^Next$/ }), 'Next → step1')
  await page.waitForTimeout(600); await shot(page, 'wizard-step1-details')

  // degree type: first button in the Degree Type grid; program: Epidemiology
  await tryClick(page, page.locator('label:has-text("Degree Type")').locator('xpath=following-sibling::div[1]').getByRole('button'), 'degree type')
  await page.selectOption('select', { label: 'Epidemiology' }).catch(() => log('skip: program select'))
  await page.waitForTimeout(400); await shot(page, 'wizard-step1-filled')
  await tryClick(page, page.getByRole('button', { name: /^Next$/ }), 'Next → step2')
  await page.waitForTimeout(600); await shot(page, 'wizard-step2-chapters')
  await tryClick(page, page.getByRole('button', { name: /^Next$/ }), 'Next → step3')
  await page.waitForTimeout(600); await shot(page, 'wizard-step3-committee')
  await tryClick(page, page.getByRole('button', { name: /Create Thesis Project/ }), 'Create Thesis Project')

  await page.waitForURL(/\/chapters/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)
  log('after create, url =', page.url()); await shot(page, 'thesis-chapters')

  const m = page.url().match(/\/projects\/([0-9a-f-]{36})/)
  const pid = m ? m[1] : null
  log('created project id =', pid)
  if (pid) {
    await page.goto(`${BASE}/projects/${pid}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500)
    await shot(page, 'thesis-overview')
    // Setup tab (invite supervisor lives here per the wizard hint)
    await tryClick(page, page.getByRole('link', { name: /^Setup$/ }), 'Setup tab')
    await page.waitForTimeout(1500); await shot(page, 'thesis-setup')
  }

  // Student → supervisor linking page
  await page.goto(`${BASE}/student/supervisor`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500)
  await shot(page, 'student-supervisor')
  await ctx.close()
} catch (e) { log('STUDENT JOURNEY FATAL:', e.message) }

// ─────────── SUPERVISOR JOURNEY ───────────
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage(); wireErrors(page, errSup)
  await login(page, SUP.email, SUP.pw)
  log('supervisor landed on', page.url()); await shot(page, 'sup-landing')
  for (const [route, name] of [
    ['/supervisor/dashboard', 'sup-dashboard'],
    ['/supervisor/inbox', 'sup-inbox'],
    ['/supervisor/students', 'sup-students'],
  ]) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(1500); await shot(page, name)
  }
  await ctx.close()
} catch (e) { log('SUPERVISOR JOURNEY FATAL:', e.message) }

console.log('\n=== STUDENT console/page errors ===')
console.log(errStudent.length ? [...new Set(errStudent)].slice(0, 25).join('\n') : '(none)')
console.log('\n=== SUPERVISOR console/page errors ===')
console.log(errSup.length ? [...new Set(errSup)].slice(0, 25).join('\n') : '(none)')
await browser.close()

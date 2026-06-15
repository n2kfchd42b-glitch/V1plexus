// Playwright QA pass for the Analysis Studio. Logs in with TEST_USER_* creds
// from .env.local (never printed), drives the analysis page, and screenshots
// each stage. Browser console + page errors are captured (catches WebR runtime
// failures). Every interaction is best-effort + try/catch so the run always
// completes and produces visual evidence.
//
// Run: node scripts/qa-studio.mjs   (dev server must be on :3001)

import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'

const BASE = process.env.QA_BASE_URL || 'http://localhost:3001'
const OUT = '/tmp/qa'
mkdirSync(OUT, { recursive: true })

// ── creds from .env.local (values never logged) ──
const env = readFileSync('.env.local', 'utf8')
const grab = k => {
  let v = (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim()
  if (v && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) v = v.slice(1, -1)
  return v
}
const EMAIL = grab('TEST_USER_EMAIL')
const PASSWORD = grab('TEST_USER_PASSWORD')
if (!EMAIL || !PASSWORD) { console.error('Missing TEST_USER_EMAIL/PASSWORD in .env.local'); process.exit(1) }

const log = (...a) => console.log('•', ...a)
const shots = []
let stepN = 0
async function shot(page, name) {
  const file = `${OUT}/${String(++stepN).padStart(2, '0')}-${name}.png`
  await page.screenshot({ path: file, fullPage: false }).catch(() => {})
  shots.push(file)
  log('screenshot:', file)
}
async function tryClick(page, locator, label, timeout = 8000) {
  try { await locator.first().click({ timeout }); log('clicked:', label); return true }
  catch { log('skip (not found):', label); return false }
}

const consoleErrors = []
const pageErrors = []

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', e => pageErrors.push(e.message))

try {
  // 1. Login (hydration-guarded: the Suspense'd form can reset controlled inputs)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(900)
  await page.fill('#email', EMAIL)
  await page.fill('#password', PASSWORD)
  if ((await page.locator('#email').inputValue()) !== EMAIL) { await page.waitForTimeout(600); await page.fill('#email', EMAIL); await page.fill('#password', PASSWORD) }
  await shot(page, 'login-filled')
  await Promise.all([
    page.waitForURL(u => !u.toString().includes('/login'), { timeout: 45000 }).catch(() => {}),
    page.click('button[type=submit]'),
  ])
  await page.waitForTimeout(2500)
  log('after login, url =', page.url())
  await shot(page, 'after-login')

  // 2. Projects → first project
  await page.goto(`${BASE}/projects`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await shot(page, 'projects')
  const href = await page.evaluate(() => {
    for (const el of document.querySelectorAll('a[href^="/projects/"]')) {
      const m = (el.getAttribute('href') || '').match(/^\/projects\/[0-9a-f-]{36}/)
      if (m) return m[0] // base /projects/<uuid>, stripped of any sub-path
    }
    return null
  })
  log('first project href =', href)

  if (href) {
    // 3. Analysis page
    await page.goto(`${BASE}${href}/analysis`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await shot(page, 'analysis-initial')
    log('crossOriginIsolated =', await page.evaluate(() => window.crossOriginIsolated).catch(() => 'n/a'))

    // 4. Load a dataset (the left "click to load" list)
    await tryClick(page, page.locator('button:has-text("rows")'), 'dataset row')
    await page.waitForTimeout(2500)
    await shot(page, 'dataset-loaded')

    // dismiss a research-context modal if it popped
    await tryClick(page, page.getByRole('button', { name: /skip|later|close/i }), 'dismiss modal', 3000)

    // 5. Enter compose (unified studio)
    await tryClick(page, page.getByRole('button', { name: /^Run Analysis$/ }), 'Run Analysis')
    await page.waitForTimeout(1500)
    await shot(page, 'compose-assist')

    // 6. Switch to Code lane
    await tryClick(page, page.getByRole('button', { name: /^Code$/ }), 'Code tab')
    await page.waitForTimeout(1000)
    await shot(page, 'code-lane')

    // 7. Run R (first run downloads the WebR runtime over the slow PostMessage
    //    channel — allow generous time and poll for the result block).
    page.on('requestfinished', req => {
      const u = req.url()
      if (/r-wasm|webr|\.wasm|\.data/.test(u)) log('net:', u.split('/').slice(-2).join('/'))
    })
    if (await tryClick(page, page.getByRole('button', { name: /Run R/ }), 'Run R')) {
      log('waiting for WebR result block (poll up to 180s)…')
      let appeared = false
      for (let i = 0; i < 36; i++) {
        await page.waitForTimeout(5000)
        const hasBlock = await page.locator('text=R script').count().catch(() => 0)
        if (hasBlock > 0) { appeared = true; log(`result block appeared after ~${(i + 1) * 5}s`); break }
      }
      if (!appeared) log('no result block after 180s')
      await shot(page, 'r-output')
    }
  }
} catch (e) {
  console.error('FATAL', e.message)
  await shot(page, 'fatal')
} finally {
  console.log('\n=== BROWSER CONSOLE ERRORS ===')
  console.log(consoleErrors.length ? consoleErrors.slice(0, 30).join('\n') : '(none)')
  console.log('\n=== PAGE ERRORS ===')
  console.log(pageErrors.length ? pageErrors.slice(0, 30).join('\n') : '(none)')
  console.log('\n=== SCREENSHOTS ===')
  console.log(shots.join('\n'))
  await browser.close()
}

// Does the analysis route actually become cross-origin isolated for an
// authenticated user? (Headers are served, but middleware/proxy + auth could
// affect delivery on the 200 document.) Logs in, opens a project's analysis
// page, and reports window.crossOriginIsolated + the document response headers.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const BASE = 'http://localhost:3001'
const env = readFileSync('.env.local', 'utf8')
const grab = k => { let v = (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim(); if (v && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) v = v.slice(1, -1); return v }
const EMAIL = grab('TEST_USER_EMAIL'), PW = grab('TEST_USER_PASSWORD')

const page = await (await (await chromium.launch({ headless: true })).newContext({ viewport: { width: 1280, height: 800 } })).newPage()
const hdrs = {}
page.on('response', r => { if (r.url().includes('/analysis') && r.request().resourceType() === 'document') { const h = r.headers(); hdrs.coop = h['cross-origin-opener-policy']; hdrs.coep = h['cross-origin-embedder-policy']; hdrs.status = r.status() } })

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.locator('#email').waitFor({ state: 'visible' }); await page.waitForTimeout(900)
await page.fill('#email', EMAIL); await page.fill('#password', PW)
if ((await page.locator('#email').inputValue()) !== EMAIL) { await page.waitForTimeout(600); await page.fill('#email', EMAIL); await page.fill('#password', PW) }
await page.click('button[type=submit]')
await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 45000 }).catch(() => {})
await page.waitForTimeout(2000)

await page.goto(`${BASE}/projects`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500)
const href = await page.evaluate(() => { for (const el of document.querySelectorAll('a[href^="/projects/"]')) { const m = (el.getAttribute('href') || '').match(/^\/projects\/[0-9a-f-]{36}/); if (m) return m[0] } return null })
console.log('project:', href)
if (href) {
  await page.goto(`${BASE}${href}/analysis`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000)
  const iso = await page.evaluate(() => window.crossOriginIsolated)
  console.log('document response headers:', JSON.stringify(hdrs))
  console.log('window.crossOriginIsolated =', iso)
}
await page.context().browser().close()

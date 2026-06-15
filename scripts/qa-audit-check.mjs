// Targeted check: log in as the QA student and open an existing thesis project's
// Overview + Setup tabs, which mount the thesis-lifecycle / supervisor timelines
// that call GET /api/audit. Confirms the audit route now returns 200 (was 500).
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const BASE = 'http://localhost:3001'
const STU = JSON.parse(readFileSync('/tmp/qa-student.json', 'utf8'))
const PID = process.argv[2] // existing project id

const page = await (await (await chromium.launch({ headless: true })).newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const audit = []
page.on('response', r => { if (r.url().includes('/api/audit')) audit.push(`${r.status()} ${r.url().split('/api/')[1].slice(0, 60)}`) })

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.locator('#email').waitFor({ state: 'visible' }); await page.waitForTimeout(900)
await page.fill('#email', STU.email); await page.fill('#password', STU.password)
await page.click('button[type=submit]')
await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 45000 }).catch(() => {})
await page.waitForTimeout(2000)

for (const tab of ['', '/setup']) {
  await page.goto(`${BASE}/projects/${PID}${tab}`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(4000)
}
console.log('=== /api/audit responses ===')
console.log(audit.length ? [...new Set(audit)].join('\n') : '(no audit calls observed)')
await page.context().browser().close()

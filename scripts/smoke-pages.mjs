/**
 * Unauthenticated page-load smoke test.
 *
 * Loads each new UI surface in headless Chromium and reports:
 *   - HTTP status of the navigation
 *   - Final URL after any redirects (middleware should bounce to /login)
 *   - Console errors raised during load
 *   - Failed network requests (excluding the expected 401s)
 *
 * Goal: catch hydration errors, missing imports, broken routes — anything
 * that would 500 on first paint. Role-specific flows are out of scope and
 * belong in the manual runbook.
 */

import { chromium } from '@playwright/test'

const BASE = 'http://localhost:3000'

const PAGES = [
  { path: '/',                                                              label: 'home (public landing)' },
  { path: '/login',                                                         label: 'login page' },
  { path: '/settings',                                                      label: 'settings (auth-gated)' },
  { path: '/settings/institution/thesis-policy',                            label: 'thesis policy admin (new)' },
  { path: '/projects/00000000-0000-0000-0000-000000000000/chapters',        label: 'chapters page w/ fake id' },
  { path: '/supervisor/dashboard',                                          label: 'supervisor dashboard' },
  { path: '/student/supervisor',                                            label: 'student supervisor search' },
  { path: '/supervisor/projects/00000000-0000-0000-0000-000000000000/documents/00000000-0000-0000-0000-000000000000', label: 'supervisor doc viewer w/ fake ids' },
]

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const results = []

  for (const p of PAGES) {
    const consoleErrors = []
    const pageErrors = []
    const failed = []

    const page = await ctx.newPage()
    page.on('console', m => {
      if (m.type() === 'error') consoleErrors.push(m.text())
    })
    page.on('pageerror', e => pageErrors.push(e.message))
    page.on('response', r => {
      const url = r.url()
      const status = r.status()
      if (status >= 500) failed.push(`${status} ${r.request().method()} ${url}`)
    })

    let status = 'load_error'
    let finalUrl = ''
    let title = ''
    try {
      const resp = await page.goto(BASE + p.path, { waitUntil: 'domcontentloaded', timeout: 15000 })
      status = resp ? String(resp.status()) : 'no_response'
      // wait a touch longer so React hydration + first effects can throw
      await page.waitForTimeout(800)
      finalUrl = page.url().replace(BASE, '')
      title = await page.title()
    } catch (e) {
      status = 'load_error: ' + (e.message || e)
    }

    results.push({
      label: p.label,
      path: p.path,
      status,
      finalUrl,
      title,
      consoleErrors,
      pageErrors,
      failed,
    })

    await page.close()
  }

  await browser.close()

  // Pretty print
  for (const r of results) {
    const ok =
      r.consoleErrors.length === 0 &&
      r.pageErrors.length === 0 &&
      r.failed.length === 0 &&
      !String(r.status).startsWith('load_error')
    console.log(`\n${ok ? 'PASS' : 'FAIL'}  ${r.label}`)
    console.log(`       path:     ${r.path}`)
    console.log(`       status:   ${r.status}`)
    console.log(`       final:    ${r.finalUrl}`)
    console.log(`       title:    ${r.title}`)
    if (r.consoleErrors.length) {
      console.log(`       console:  ${r.consoleErrors.length} errors`)
      r.consoleErrors.slice(0, 3).forEach(e => console.log(`         - ${e.slice(0, 200)}`))
    }
    if (r.pageErrors.length) {
      console.log(`       page:     ${r.pageErrors.length} uncaught`)
      r.pageErrors.slice(0, 3).forEach(e => console.log(`         - ${e.slice(0, 200)}`))
    }
    if (r.failed.length) {
      console.log(`       5xx:      ${r.failed.length}`)
      r.failed.slice(0, 5).forEach(e => console.log(`         - ${e}`))
    }
  }

  const failures = results.filter(r =>
    r.consoleErrors.length || r.pageErrors.length || r.failed.length || String(r.status).startsWith('load_error'),
  )
  console.log(`\n${failures.length === 0 ? 'all green' : `${failures.length}/${results.length} failed`}`)
  process.exit(failures.length === 0 ? 0 : 1)
}

main().catch(e => {
  console.error('Smoke run crashed:', e)
  process.exit(2)
})

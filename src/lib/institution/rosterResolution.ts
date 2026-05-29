/**
 * Roster upload helpers: turn free-text programme/cohort references from a
 * spreadsheet into deterministic slugs, derive sensible defaults for any new
 * programme we have to auto-create, and detect ambiguous source strings that
 * collapse to the same slug.
 *
 * Shared between the preview phase (no writes) and the commit phase so the
 * resolution logic is guaranteed identical.
 */

import type { DegreeLevel } from '@/types/database'

export function slugifyProgrammeName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, ' ')                    // punctuation → space
    .trim()
    .replace(/[\s-]+/g, '-')                          // collapse whitespace + hyphens
    .replace(/^-+|-+$/g, '')
}

/**
 * Map the leading academic prefix (BSc, MSc, PhD, …) to a `DegreeLevel`
 * enum value. The schema enum is `'bachelor' | 'master' | 'phd' | 'postdoc'
 * | 'staff' | 'other'` — there is no dedicated HND tier, so HND/HNC fall
 * back to `'other'`.
 */
export function deriveDegreeLevel(programmeName: string): DegreeLevel {
  const head = programmeName.trim().toUpperCase().split(/[\s\-_]+/, 2)[0] ?? ''
  if (/^(BSC|BA|BENG|BBA|BCOM|BED|BPHIL|BTECH)$/.test(head)) return 'bachelor'
  if (/^(MSC|MA|MPHIL|MBA|MENG|MED|MRES|LLM|MTECH)$/.test(head)) return 'master'
  if (/^(PHD|DPHIL|DSC|EDD)$/.test(head)) return 'phd'
  return 'other'
}

/**
 * Initials of the programme name, uppercased. Drops connector words.
 * "BSc Computer Science" → "BCS"; "Master of Business Administration" → "MBA".
 */
function programmeInitials(name: string): string {
  const stop = new Set(['of', 'and', 'in', 'the', 'for', 'a', 'an', '&'])
  const initials = name
    .split(/[\s\-_/]+/)
    .filter((w) => w && !stop.has(w.toLowerCase()))
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  return initials || name.replace(/\s+/g, '').slice(0, 3).toUpperCase()
}

export function generateShortCode(name: string, taken: Set<string>): string {
  const base = programmeInitials(name).slice(0, 8)
  if (!taken.has(base)) return base
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
  // Extremely unlikely fallback
  return `${base}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`
}

// ── Row-level resolution ───────────────────────────────────────────────────

export interface ExistingProgramme {
  id: string
  name: string
  short_code: string | null
  degree_level: DegreeLevel
}

export interface ResolvedProgrammeNew {
  kind: 'new'
  slug: string
  name: string            // The first source-string we saw for this slug
  short_code: string
  degree_level: DegreeLevel
  department_name: string | null
  source_variants: string[] // All raw strings that resolved to this slug
}

export interface ResolvedProgrammeExisting {
  kind: 'existing'
  slug: string
  id: string
  name: string
  source_variants: string[]
}

export type ResolvedProgramme = ResolvedProgrammeNew | ResolvedProgrammeExisting

export interface ResolvedCohortNew {
  kind: 'new'
  key: string             // programme slug | year | normalised label
  programme_slug: string
  year: number
  label: string | null
}

export interface ResolvedCohortExisting {
  kind: 'existing'
  key: string
  id: string
  programme_slug: string
  year: number
  label: string | null
}

export type ResolvedCohort = ResolvedCohortNew | ResolvedCohortExisting

export function cohortKey(programmeSlug: string, year: number, label: string | null): string {
  return `${programmeSlug}|${year}|${(label ?? '').toLowerCase().trim()}`
}

/**
 * Build a slug→existing-programme lookup using BOTH the programme's `name`
 * and its `short_code` so a roster row can reference either form.
 */
export function buildProgrammeLookup(
  existing: ExistingProgramme[]
): Map<string, ExistingProgramme> {
  const lookup = new Map<string, ExistingProgramme>()
  for (const p of existing) {
    const nameSlug = slugifyProgrammeName(p.name)
    if (nameSlug) lookup.set(nameSlug, p)
    if (p.short_code) {
      const codeSlug = slugifyProgrammeName(p.short_code)
      if (codeSlug && !lookup.has(codeSlug)) lookup.set(codeSlug, p)
    }
  }
  return lookup
}

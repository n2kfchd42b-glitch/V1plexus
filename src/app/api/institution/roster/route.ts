import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'
import { writeAuditEntry } from '@/lib/audit/auditLogger'
import { parseCsv, indexHeader } from '@/lib/csv'
import { escapeLikePattern, postgrestQuote } from '@/lib/utils'
import {
  slugifyProgrammeName,
  deriveDegreeLevel,
  generateShortCode,
  buildProgrammeLookup,
  cohortKey,
  type ExistingProgramme,
} from '@/lib/institution/rosterResolution'
import type { DegreeLevel } from '@/types/database'

/**
 * Roster (the matriculation list).
 *
 * GET  — list entries with filters (status, programme_id, cohort_id, search).
 * POST — three modes:
 *   { matriculation_number: ... }       → single-row insert
 *   { csv, mode: 'preview' }            → parse + resolve, return preview only
 *   { csv, mode: 'commit' }             → parse + resolve + auto-provision +
 *                                          insert. (Default if `mode` omitted.)
 */

const INTENDED_ROLES = ['researcher', 'student', 'supervisor', 'admin', 'coordinator', 'viewer'] as const

const createSchema = z.object({
  matriculation_number: z.string().trim().min(1).max(100),
  full_name_hint: z.string().trim().max(200).nullable().optional(),
  email_hint: z.string().trim().max(254).nullable().optional(),
  programme_id: z.string().uuid().nullable().optional(),
  cohort_id: z.string().uuid().nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  intended_role: z.enum(INTENDED_ROLES).default('researcher'),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const params = new URL(request.url).searchParams
  const status = params.get('status')
  const programmeId = params.get('programme_id')
  const cohortId = params.get('cohort_id')
  const search = params.get('search')?.trim()

  const svc = createServiceClient()
  let q = svc
    .from('institution_roster_entries')
    .select(`
      id, institution_id, matriculation_number, programme_id, cohort_id, department_id,
      intended_role, full_name_hint, email_hint, notes, status,
      claimed_by, claimed_at, uploaded_by, created_at, updated_at,
      programme:institution_programmes(id, name, degree_level),
      cohort:institution_cohorts(id, year, label),
      department:departments(id, name),
      claimed_user:profiles!institution_roster_entries_claimed_by_fkey(id, full_name, email)
    `, { count: 'exact' })
    .eq('institution_id', ctx.institutionId)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(1000)

  if (status) q = q.eq('status', status)
  if (programmeId) q = q.eq('programme_id', programmeId)
  if (cohortId) q = q.eq('cohort_id', cohortId)
  if (search) {
    const pattern = postgrestQuote(`%${escapeLikePattern(search)}%`)
    q = q.or(
      `matriculation_number.ilike.${pattern},` +
      `full_name_hint.ilike.${pattern},` +
      `email_hint.ilike.${pattern}`
    )
  }

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ entries: data ?? [], total: count ?? 0 })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body === 'object' && body !== null && 'csv' in body) {
    const csv = (body as { csv: unknown }).csv
    const mode = (body as { mode?: unknown }).mode
    const resolvedMode: 'preview' | 'commit' =
      mode === 'preview' ? 'preview' : 'commit'
    return handleCsvUpload(ctx, csv, resolvedMode)
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const svc = createServiceClient()
  if (parsed.data.programme_id) {
    const { data: prog } = await svc.from('institution_programmes').select('id').eq('id', parsed.data.programme_id).eq('institution_id', ctx.institutionId).maybeSingle()
    if (!prog) return NextResponse.json({ error: 'Programme not in your institution' }, { status: 400 })
  }
  if (parsed.data.cohort_id) {
    if (!parsed.data.programme_id) return NextResponse.json({ error: 'cohort_id requires programme_id' }, { status: 400 })
    const { data: cohort } = await svc.from('institution_cohorts').select('id').eq('id', parsed.data.cohort_id).eq('programme_id', parsed.data.programme_id).maybeSingle()
    if (!cohort) return NextResponse.json({ error: 'Cohort does not belong to programme' }, { status: 400 })
  }
  if (parsed.data.department_id) {
    const { data: dept } = await svc.from('departments').select('id').eq('id', parsed.data.department_id).eq('institution_id', ctx.institutionId).maybeSingle()
    if (!dept) return NextResponse.json({ error: 'Department not in your institution' }, { status: 400 })
  }

  const { data, error } = await svc
    .from('institution_roster_entries')
    .insert({
      institution_id: ctx.institutionId,
      matriculation_number: parsed.data.matriculation_number,
      full_name_hint: parsed.data.full_name_hint || null,
      email_hint: parsed.data.email_hint || null,
      programme_id: parsed.data.programme_id ?? null,
      cohort_id: parsed.data.cohort_id ?? null,
      department_id: parsed.data.department_id ?? null,
      intended_role: parsed.data.intended_role,
      notes: parsed.data.notes || null,
      uploaded_by: ctx.userId,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A roster entry with that matriculation number already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  void writeAuditEntry({
    actor_id: ctx.userId,
    action: 'institution.roster.uploaded',
    resource_type: 'institution_roster_entry',
    resource_id: data.id,
    institution_id: ctx.institutionId,
    details: {
      summary: `Added roster entry ${parsed.data.matriculation_number}`,
      inserted: 1,
      mode: 'single',
    },
  })

  return NextResponse.json({ success: true, entry: data })
}

// ── CSV upload ────────────────────────────────────────────────────────────

interface CsvOutcome {
  line: number
  matric?: string
  status: 'inserted' | 'skipped' | 'error'
  reason?: string
  warnings?: string[]
}

interface ResolvedRow {
  line: number
  matric: string
  matricKey: string
  fullName: string | null
  email: string | null
  intendedRole: typeof INTENDED_ROLES[number]
  notes: string | null
  programmeSlug: string | null
  cohortKey: string | null
  departmentName: string | null
  warnings: string[]
}

async function handleCsvUpload(
  ctx: { userId: string; institutionId: string },
  csvRaw: unknown,
  mode: 'preview' | 'commit',
): Promise<NextResponse> {
  if (typeof csvRaw !== 'string') {
    return NextResponse.json({ error: 'csv must be a string' }, { status: 400 })
  }
  if (csvRaw.length > 10_000_000) {
    return NextResponse.json({ error: 'CSV too large (>10MB)' }, { status: 413 })
  }

  const rows = parseCsv(csvRaw)
  if (rows.length < 2) {
    return NextResponse.json({ error: 'CSV needs a header row and at least one data row' }, { status: 400 })
  }

  const header = rows[0]
  const idx = {
    matric:       indexHeader(header, ['matriculation_number', 'matric', 'matric_number']),
    fullName:     indexHeader(header, ['full_name', 'name']),
    email:        indexHeader(header, ['email']),
    programme:    indexHeader(header, ['programme', 'program']),
    cohortYear:   indexHeader(header, ['cohort_year', 'year']),
    cohortLabel:  indexHeader(header, ['cohort_label', 'cohort']),
    department:   indexHeader(header, ['department', 'dept']),
    role:         indexHeader(header, ['intended_role', 'role']),
    notes:        indexHeader(header, ['notes']),
  }

  if (idx.matric < 0) {
    return NextResponse.json({ error: "CSV is missing a 'matriculation_number' column" }, { status: 400 })
  }

  const svc = createServiceClient()

  const [progRes, cohortRes, deptRes, existingMatricRes] = await Promise.all([
    svc.from('institution_programmes')
      .select('id, name, short_code, degree_level')
      .eq('institution_id', ctx.institutionId),
    svc.from('institution_cohorts').select(`
      id, year, label,
      programme:institution_programmes!inner(id, institution_id, name, short_code)
    `).eq('programme.institution_id', ctx.institutionId),
    svc.from('departments').select('id, name').eq('institution_id', ctx.institutionId),
    svc.from('institution_roster_entries').select('matriculation_number').eq('institution_id', ctx.institutionId),
  ])

  const existingProgrammes: ExistingProgramme[] = (progRes.data ?? []) as ExistingProgramme[]
  const programmeBySlug = buildProgrammeLookup(existingProgrammes)
  const programmeById = new Map<string, ExistingProgramme>(
    existingProgrammes.map((p) => [p.id, p])
  )

  // Existing cohort lookup keyed by slug|year|label
  const existingCohortByKey = new Map<string, { id: string; programmeSlug: string; year: number; label: string | null }>()
  for (const c of cohortRes.data ?? []) {
    const prog = c.programme as { id?: string; name?: string; short_code?: string | null } | null
    if (!prog?.id || !prog.name) continue
    const slug = slugifyProgrammeName(prog.name)
    if (!slug) continue
    const k = cohortKey(slug, c.year, c.label)
    existingCohortByKey.set(k, { id: c.id, programmeSlug: slug, year: c.year, label: c.label })
  }

  const departmentByName = new Map<string, string>()
  for (const d of deptRes.data ?? []) {
    departmentByName.set(d.name.toLowerCase().trim(), d.id)
  }

  const existingMatric = new Set<string>(
    (existingMatricRes.data ?? []).map((r) => r.matriculation_number.toLowerCase().trim())
  )

  // ── Pass 1: per-row resolution (no writes) ──────────────────────────────

  const outcomes: CsvOutcome[] = []
  const resolved: ResolvedRow[] = []
  const seenInBatch = new Set<string>()

  // Programmes/cohorts we'll need to create. Keyed by slug / cohort key.
  const newProgrammesBySlug = new Map<string, {
    slug: string
    chosenName: string
    sourceVariants: Set<string>
    degree_level: DegreeLevel
    department_name: string | null
  }>()
  const newCohortsByKey = new Map<string, { programmeSlug: string; year: number; label: string | null }>()
  const ambiguousProgrammes = new Map<string, Set<string>>() // slug → raw source strings (>1)

  for (let r = 1; r < rows.length; r++) {
    const line = r + 1
    const cells = rows[r]
    if (cells.every((c) => c.trim() === '')) continue

    const matricRaw = (cells[idx.matric] ?? '').trim()
    if (!matricRaw) {
      outcomes.push({ line, status: 'error', reason: 'matriculation_number is required' })
      continue
    }
    const matricKey = matricRaw.toLowerCase().trim()

    if (existingMatric.has(matricKey)) {
      outcomes.push({ line, matric: matricRaw, status: 'skipped', reason: 'already in roster' })
      continue
    }
    if (seenInBatch.has(matricKey)) {
      outcomes.push({ line, matric: matricRaw, status: 'error', reason: 'duplicate within CSV' })
      continue
    }

    const rowWarnings: string[] = []

    // Programme resolution — match by slug; if not, plan a new one.
    let programmeSlug: string | null = null
    if (idx.programme >= 0) {
      const rawProg = (cells[idx.programme] ?? '').trim()
      if (rawProg) {
        const slug = slugifyProgrammeName(rawProg)
        if (!slug) {
          rowWarnings.push(`programme '${rawProg}' could not be normalised — left unassigned`)
        } else {
          programmeSlug = slug
          if (!programmeBySlug.has(slug)) {
            // Plan a new programme
            const planned = newProgrammesBySlug.get(slug)
            const deptCellRaw = idx.department >= 0 ? (cells[idx.department] ?? '').trim() : ''
            if (planned) {
              planned.sourceVariants.add(rawProg)
              if (!planned.department_name && deptCellRaw) {
                planned.department_name = deptCellRaw
              }
            } else {
              newProgrammesBySlug.set(slug, {
                slug,
                chosenName: rawProg,
                sourceVariants: new Set([rawProg]),
                degree_level: deriveDegreeLevel(rawProg),
                department_name: deptCellRaw || null,
              })
            }
          } else {
            // Track ambiguity: existing programme name (or matched short_code)
            // differs from the source string we just saw.
            const existing = programmeBySlug.get(slug)!
            if (
              existing.name.toLowerCase() !== rawProg.toLowerCase() &&
              (existing.short_code ?? '').toLowerCase() !== rawProg.toLowerCase()
            ) {
              const set = ambiguousProgrammes.get(slug) ?? new Set([existing.name])
              set.add(rawProg)
              ambiguousProgrammes.set(slug, set)
            }
          }
        }
      }
    }

    // Cohort resolution — only if we have a programme.
    let resolvedCohortKey: string | null = null
    if (programmeSlug && idx.cohortYear >= 0) {
      const yearRaw = (cells[idx.cohortYear] ?? '').trim()
      const labelRaw = idx.cohortLabel >= 0 ? (cells[idx.cohortLabel] ?? '').trim() : ''
      if (yearRaw) {
        const yearN = Number(yearRaw)
        if (!Number.isFinite(yearN) || yearN < 1900 || yearN > 2200) {
          outcomes.push({ line, matric: matricRaw, status: 'error', reason: `invalid cohort_year: ${yearRaw}` })
          continue
        }
        const label = labelRaw || null
        const k = cohortKey(programmeSlug, yearN, label)
        resolvedCohortKey = k
        if (!existingCohortByKey.has(k) && !newCohortsByKey.has(k)) {
          newCohortsByKey.set(k, { programmeSlug, year: yearN, label })
        }
      }
    }

    // Department — looked up against existing departments only (we don't
    // auto-create departments; mirrors prior behaviour).
    let departmentName: string | null = null
    if (idx.department >= 0) {
      const v = (cells[idx.department] ?? '').trim()
      if (v) {
        departmentName = v
        if (!departmentByName.has(v.toLowerCase().trim())) {
          rowWarnings.push(`department '${v}' not found — left unassigned`)
        }
      }
    }

    // Role — hard error if unknown enum value.
    let intendedRole: typeof INTENDED_ROLES[number] = 'researcher'
    if (idx.role >= 0) {
      const v = (cells[idx.role] ?? '').trim().toLowerCase()
      if (v) {
        if (!(INTENDED_ROLES as readonly string[]).includes(v)) {
          outcomes.push({ line, matric: matricRaw, status: 'error', reason: `unknown intended_role: ${v}` })
          continue
        }
        intendedRole = v as typeof INTENDED_ROLES[number]
      }
    }

    const fullName = idx.fullName >= 0 ? (cells[idx.fullName] ?? '').trim() : ''
    const email = idx.email >= 0 ? (cells[idx.email] ?? '').trim() : ''
    const notes = idx.notes >= 0 ? (cells[idx.notes] ?? '').trim() : ''

    resolved.push({
      line,
      matric: matricRaw,
      matricKey,
      fullName: fullName || null,
      email: email || null,
      intendedRole,
      notes: notes || null,
      programmeSlug,
      cohortKey: resolvedCohortKey,
      departmentName,
      warnings: rowWarnings,
    })
    seenInBatch.add(matricKey)
    outcomes.push({ line, matric: matricRaw, status: 'inserted', ...(rowWarnings.length > 0 && { warnings: rowWarnings }) })
  }

  // ── Build preview structures ────────────────────────────────────────────

  // Generate short codes against the union of existing short_codes + ones
  // already minted this batch.
  const takenShortCodes = new Set<string>()
  for (const p of existingProgrammes) {
    if (p.short_code) takenShortCodes.add(p.short_code.toUpperCase())
  }
  const newProgrammesPlan = [...newProgrammesBySlug.values()].map((p) => {
    const code = generateShortCode(p.chosenName, takenShortCodes)
    takenShortCodes.add(code.toUpperCase())
    return {
      slug: p.slug,
      name: p.chosenName,
      short_code: code,
      degree_level: p.degree_level,
      department_name: p.department_name,
      source_variants: [...p.sourceVariants].sort(),
    }
  })

  const newCohortsPlan = [...newCohortsByKey.values()]
  const supervisorList = resolved
    .filter((r) => r.intendedRole === 'supervisor')
    .map((r) => ({ matric: r.matric, full_name: r.fullName, email: r.email }))

  const generalWarnings: string[] = []
  for (const [slug, variants] of ambiguousProgrammes.entries()) {
    generalWarnings.push(
      `Programme '${slug}' matched multiple source strings: ${[...variants].join(' / ')} — treating them as the same programme.`
    )
  }

  const inserted = outcomes.filter((o) => o.status === 'inserted').length
  const skipped = outcomes.filter((o) => o.status === 'skipped').length
  const errors = outcomes.filter((o) => o.status === 'error').length

  if (mode === 'preview') {
    const existingProgrammesUsed = new Set<string>()
    for (const r of resolved) {
      if (r.programmeSlug && programmeBySlug.has(r.programmeSlug)) {
        existingProgrammesUsed.add(programmeBySlug.get(r.programmeSlug)!.id)
      }
    }
    return NextResponse.json({
      mode: 'preview',
      summary: {
        total_rows: rows.length - 1,
        students: resolved.filter((r) => r.intendedRole !== 'supervisor').length,
        supervisors: supervisorList.length,
        will_insert: inserted,
        will_skip: skipped,
        errors,
      },
      new_programmes: newProgrammesPlan,
      new_cohorts: newCohortsPlan,
      existing_programmes: [...existingProgrammesUsed]
        .map((id) => programmeById.get(id))
        .filter((p): p is ExistingProgramme => !!p)
        .map((p) => ({ id: p.id, name: p.name, short_code: p.short_code, degree_level: p.degree_level })),
      supervisors: supervisorList,
      warnings: generalWarnings,
      outcomes,
    })
  }

  // ── Commit phase ────────────────────────────────────────────────────────

  if (resolved.length === 0) {
    return NextResponse.json({
      mode: 'commit',
      summary: { total_rows: rows.length - 1, inserted: 0, skipped, errors },
      new_programmes: [],
      new_cohorts: [],
      warnings: generalWarnings,
      outcomes,
    })
  }

  // 1) Provision new programmes
  const createdProgrammeIdBySlug = new Map<string, string>()
  const createdProgrammeRecords: { id: string; name: string; slug: string; short_code: string; degree_level: DegreeLevel }[] = []
  if (newProgrammesPlan.length > 0) {
    const insertRows = newProgrammesPlan.map((p) => {
      const deptId = p.department_name
        ? departmentByName.get(p.department_name.toLowerCase().trim()) ?? null
        : null
      return {
        institution_id: ctx.institutionId,
        name: p.name,
        short_code: p.short_code,
        degree_level: p.degree_level,
        department_id: deptId,
      }
    })
    const { data: progInserted, error: progErr } = await svc
      .from('institution_programmes')
      .insert(insertRows)
      .select('id, name, short_code, degree_level')
    if (progErr) {
      return NextResponse.json({ error: `Could not create programmes: ${progErr.message}` }, { status: 500 })
    }
    for (const row of progInserted ?? []) {
      const slug = slugifyProgrammeName(row.name)
      createdProgrammeIdBySlug.set(slug, row.id)
      createdProgrammeRecords.push({
        id: row.id,
        name: row.name,
        slug,
        short_code: row.short_code,
        degree_level: row.degree_level as DegreeLevel,
      })
    }
  }

  // Combined slug→id resolver
  const resolveProgrammeId = (slug: string | null): string | null => {
    if (!slug) return null
    if (programmeBySlug.has(slug)) return programmeBySlug.get(slug)!.id
    return createdProgrammeIdBySlug.get(slug) ?? null
  }

  // 2) Provision new cohorts
  const createdCohortIdByKey = new Map<string, string>()
  const cohortInsertPayloads: { programme_id: string; year: number; label: string | null; key: string }[] = []
  for (const c of newCohortsPlan) {
    const pid = resolveProgrammeId(c.programmeSlug)
    if (!pid) continue
    cohortInsertPayloads.push({
      programme_id: pid,
      year: c.year,
      label: c.label,
      key: cohortKey(c.programmeSlug, c.year, c.label),
    })
  }
  if (cohortInsertPayloads.length > 0) {
    const { data: cohortInserted, error: cohortErr } = await svc
      .from('institution_cohorts')
      .insert(cohortInsertPayloads.map((c) => ({
        programme_id: c.programme_id,
        year: c.year,
        label: c.label,
      })))
      .select('id, programme_id, year, label')
    if (cohortErr) {
      return NextResponse.json({ error: `Could not create cohorts: ${cohortErr.message}` }, { status: 500 })
    }
    // Reverse map: programme_id → slug, across both pre-existing and just-
    // created programmes. We re-key by content rather than relying on insert
    // order to stay safe.
    const slugByProgrammeId = new Map<string, string>()
    for (const [slug, id] of createdProgrammeIdBySlug.entries()) {
      slugByProgrammeId.set(id, slug)
    }
    for (const p of existingProgrammes) {
      slugByProgrammeId.set(p.id, slugifyProgrammeName(p.name))
    }
    for (const row of cohortInserted ?? []) {
      const slug = slugByProgrammeId.get(row.programme_id)
      if (!slug) continue
      createdCohortIdByKey.set(cohortKey(slug, row.year, row.label), row.id)
    }
  }

  const resolveCohortId = (key: string | null): string | null => {
    if (!key) return null
    if (existingCohortByKey.has(key)) return existingCohortByKey.get(key)!.id
    return createdCohortIdByKey.get(key) ?? null
  }

  // 3) Insert roster entries
  const insertPayload = resolved.map((r) => {
    const programmeId = resolveProgrammeId(r.programmeSlug)
    // Supervisors are not pinned to a single cohort.
    const cohortId = r.intendedRole === 'supervisor' ? null : resolveCohortId(r.cohortKey)
    const departmentId = r.departmentName
      ? departmentByName.get(r.departmentName.toLowerCase().trim()) ?? null
      : null
    return {
      institution_id: ctx.institutionId,
      matriculation_number: r.matric,
      full_name_hint: r.fullName,
      email_hint: r.email,
      programme_id: programmeId,
      cohort_id: cohortId,
      department_id: departmentId,
      intended_role: r.intendedRole,
      notes: r.notes,
      uploaded_by: ctx.userId,
    }
  })

  const { error: insertErr } = await svc.from('institution_roster_entries').insert(insertPayload)
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message, outcomes }, { status: 500 })
  }

  void writeAuditEntry({
    actor_id: ctx.userId,
    action: 'institution.roster.uploaded',
    resource_type: 'institution',
    resource_id: ctx.institutionId,
    institution_id: ctx.institutionId,
    details: {
      summary: `Uploaded roster: ${insertPayload.length} inserted, ${skipped} skipped, ${errors} errors, ${createdProgrammeRecords.length} new programmes, ${cohortInsertPayloads.length} new cohorts`,
      inserted: insertPayload.length,
      skipped,
      errors,
      new_programmes: createdProgrammeRecords.length,
      new_cohorts: cohortInsertPayloads.length,
      supervisors: supervisorList.length,
      mode: 'csv',
    },
  })

  // Best-effort: log a creation event per auto-provisioned programme so the
  // audit trail names them.
  for (const p of createdProgrammeRecords) {
    void writeAuditEntry({
      actor_id: ctx.userId,
      action: 'institution.programme.created',
      resource_type: 'institution_programme',
      resource_id: p.id,
      institution_id: ctx.institutionId,
      details: {
        summary: `Auto-created programme ${p.name} (${p.degree_level}) from roster upload`,
        degree_level: p.degree_level,
        short_code: p.short_code,
        via: 'roster_upload',
      },
    })
  }

  return NextResponse.json({
    mode: 'commit',
    summary: {
      total_rows: rows.length - 1,
      inserted: insertPayload.length,
      skipped,
      errors,
      new_programmes: createdProgrammeRecords.length,
      new_cohorts: cohortInsertPayloads.length,
      supervisors: supervisorList.length,
    },
    new_programmes: createdProgrammeRecords.map((p) => ({
      id: p.id, name: p.name, short_code: p.short_code, degree_level: p.degree_level,
    })),
    new_cohorts: cohortInsertPayloads.map((c) => ({
      id: createdCohortIdByKey.get(c.key) ?? null,
      programme_id: c.programme_id,
      year: c.year,
      label: c.label,
    })),
    warnings: generalWarnings,
    outcomes,
  })
}


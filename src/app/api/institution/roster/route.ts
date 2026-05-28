import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'
import { writeAuditEntry } from '@/lib/audit/auditLogger'
import { parseCsv, indexHeader } from '@/lib/csv'

/**
 * Roster (the matriculation list).
 *
 * GET  — list entries with filters (status, programme_id, cohort_id, search).
 * POST — single insert; for CSV upload use POST /api/institution/roster/bulk.
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
    .order('status', { ascending: true }) // unclaimed first
    .order('created_at', { ascending: false })
    .limit(1000)

  if (status) q = q.eq('status', status)
  if (programmeId) q = q.eq('programme_id', programmeId)
  if (cohortId) q = q.eq('cohort_id', cohortId)
  if (search) {
    // Search across matric, full_name, email
    q = q.or(`matriculation_number.ilike.%${search}%,full_name_hint.ilike.%${search}%,email_hint.ilike.%${search}%`)
  }

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ entries: data ?? [], total: count ?? 0 })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Two modes:
  //   { csv: "..." }                  → bulk CSV upload
  //   { matriculation_number: ... }   → single-row insert
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body === 'object' && body !== null && 'csv' in body) {
    return handleCsvUpload(ctx, (body as { csv: unknown }).csv)
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const svc = createServiceClient()
  // Belongs-to checks
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
}

async function handleCsvUpload(
  ctx: { userId: string; institutionId: string },
  csvRaw: unknown,
): Promise<NextResponse> {
  if (typeof csvRaw !== 'string') {
    return NextResponse.json({ error: 'csv must be a string' }, { status: 400 })
  }
  if (csvRaw.length > 2_000_000) {
    return NextResponse.json({ error: 'CSV too large (>2MB)' }, { status: 413 })
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

  // Pre-load institution programmes + cohorts + departments for lookup.
  const [progRes, cohortRes, deptRes, existingMatricRes] = await Promise.all([
    svc.from('institution_programmes').select('id, name').eq('institution_id', ctx.institutionId),
    svc.from('institution_cohorts').select(`
      id, year, label,
      programme:institution_programmes!inner(id, institution_id, name)
    `).eq('programme.institution_id', ctx.institutionId),
    svc.from('departments').select('id, name').eq('institution_id', ctx.institutionId),
    svc.from('institution_roster_entries').select('matriculation_number').eq('institution_id', ctx.institutionId),
  ])

  const normalise = (s: string) => s.toLowerCase().trim()
  const progByName = new Map<string, string>()
  for (const p of progRes.data ?? []) progByName.set(normalise(p.name), p.id)
  const deptByName = new Map<string, string>()
  for (const d of deptRes.data ?? []) deptByName.set(normalise(d.name), d.id)

  // Cohort lookup keyed by (programme_id|year|label-normalised)
  const cohortKey = (pid: string, year: number, label: string | null) =>
    `${pid}|${year}|${label ? normalise(label) : ''}`
  const cohortByKey = new Map<string, string>()
  for (const c of cohortRes.data ?? []) {
    const prog = c.programme as { id?: string } | null
    if (!prog?.id) continue
    cohortByKey.set(cohortKey(prog.id, c.year, c.label), c.id)
  }

  const existingMatric = new Set<string>(
    (existingMatricRes.data ?? []).map((r) => normalise(r.matriculation_number))
  )

  const outcomes: CsvOutcome[] = []
  const toInsert: Record<string, unknown>[] = []
  const seenInBatch = new Set<string>()

  for (let r = 1; r < rows.length; r++) {
    const line = r + 1 // header is line 1
    const cells = rows[r]
    if (cells.every((c) => c.trim() === '')) continue

    const matricRaw = (cells[idx.matric] ?? '').trim()
    if (!matricRaw) {
      outcomes.push({ line, status: 'error', reason: 'matriculation_number is required' })
      continue
    }
    const matricKey = normalise(matricRaw)

    if (existingMatric.has(matricKey)) {
      outcomes.push({ line, matric: matricRaw, status: 'skipped', reason: 'already in roster' })
      continue
    }
    if (seenInBatch.has(matricKey)) {
      outcomes.push({ line, matric: matricRaw, status: 'error', reason: 'duplicate within CSV' })
      continue
    }

    // Programme lookup
    let programmeId: string | null = null
    if (idx.programme >= 0) {
      const v = (cells[idx.programme] ?? '').trim()
      if (v) {
        programmeId = progByName.get(normalise(v)) ?? null
        if (!programmeId) {
          outcomes.push({ line, matric: matricRaw, status: 'error', reason: `unknown programme: ${v}` })
          continue
        }
      }
    }

    // Cohort lookup
    let cohortId: string | null = null
    if (programmeId && idx.cohortYear >= 0) {
      const yearRaw = (cells[idx.cohortYear] ?? '').trim()
      const labelRaw = idx.cohortLabel >= 0 ? (cells[idx.cohortLabel] ?? '').trim() : ''
      if (yearRaw) {
        const yearN = Number(yearRaw)
        if (!Number.isFinite(yearN) || yearN < 1900 || yearN > 2200) {
          outcomes.push({ line, matric: matricRaw, status: 'error', reason: `invalid cohort_year: ${yearRaw}` })
          continue
        }
        const key = cohortKey(programmeId, yearN, labelRaw || null)
        cohortId = cohortByKey.get(key) ?? null
        if (!cohortId) {
          outcomes.push({
            line, matric: matricRaw, status: 'error',
            reason: `cohort ${yearN}${labelRaw ? ` (${labelRaw})` : ''} not found for that programme`,
          })
          continue
        }
      }
    }

    // Department lookup
    let departmentId: string | null = null
    if (idx.department >= 0) {
      const v = (cells[idx.department] ?? '').trim()
      if (v) {
        departmentId = deptByName.get(normalise(v)) ?? null
        if (!departmentId) {
          outcomes.push({ line, matric: matricRaw, status: 'error', reason: `unknown department: ${v}` })
          continue
        }
      }
    }

    // Role
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

    toInsert.push({
      institution_id: ctx.institutionId,
      matriculation_number: matricRaw,
      full_name_hint: fullName || null,
      email_hint: email || null,
      programme_id: programmeId,
      cohort_id: cohortId,
      department_id: departmentId,
      intended_role: intendedRole,
      notes: notes || null,
      uploaded_by: ctx.userId,
    })
    seenInBatch.add(matricKey)
    outcomes.push({ line, matric: matricRaw, status: 'inserted' })
  }

  if (toInsert.length === 0) {
    return NextResponse.json({
      summary: { total_rows: rows.length - 1, inserted: 0, skipped: outcomes.filter(o => o.status === 'skipped').length, errors: outcomes.filter(o => o.status === 'error').length },
      outcomes,
    })
  }

  const { error: insertErr } = await svc.from('institution_roster_entries').insert(toInsert)
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
      summary: `Uploaded roster: ${toInsert.length} inserted, ${outcomes.filter(o => o.status === 'skipped').length} skipped, ${outcomes.filter(o => o.status === 'error').length} errors`,
      inserted: toInsert.length,
      skipped: outcomes.filter(o => o.status === 'skipped').length,
      errors: outcomes.filter(o => o.status === 'error').length,
      mode: 'csv',
    },
  })

  return NextResponse.json({
    summary: {
      total_rows: rows.length - 1,
      inserted: toInsert.length,
      skipped: outcomes.filter(o => o.status === 'skipped').length,
      errors: outcomes.filter(o => o.status === 'error').length,
    },
    outcomes,
  })
}

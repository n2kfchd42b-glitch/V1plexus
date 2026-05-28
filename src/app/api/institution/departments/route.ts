import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * Departments are an existing table but had no admin-facing CRUD. Programmes
 * and roster entries reference departments, so admins need to create them.
 */

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  head_id: z.string().uuid().nullable().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('departments')
    .select('id, institution_id, name, description, head_id, created_at, updated_at')
    .eq('institution_id', ctx.institutionId)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ departments: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const svc = createServiceClient()

  // If head_id supplied, ensure they're linked to this institution.
  if (parsed.data.head_id) {
    const { data: head } = await svc
      .from('profiles')
      .select('id, institution_id')
      .eq('id', parsed.data.head_id)
      .maybeSingle()
    if (!head || head.institution_id !== ctx.institutionId) {
      return NextResponse.json({ error: 'Head must be a member of your institution' }, { status: 400 })
    }
  }

  const { data, error } = await svc
    .from('departments')
    .insert({
      institution_id: ctx.institutionId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      head_id: parsed.data.head_id ?? null,
    })
    .select('id, name')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A department with that name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  void writeAuditEntry({
    actor_id: ctx.userId,
    action: 'institution.admin.updated',
    resource_type: 'institution',
    resource_id: ctx.institutionId,
    institution_id: ctx.institutionId,
    details: {
      summary: `Created department ${data.name}`,
      department_id: data.id,
    },
  })

  return NextResponse.json({ success: true, department: data })
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getScope } from '@/lib/admin/scope'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * Department-scoped milestone templates ("playbook").
 *
 *   GET  — list templates for this department, sorted by order_index
 *   POST — create a new template; defaults to the end of the playbook
 *
 * Access: institution admins, or dept heads of THIS dept.
 *
 * Note: institution-default templates (department_id = NULL) are NOT included
 * here — they're managed elsewhere. This endpoint is the dept's own playbook.
 */

const createSchema = z.object({
  title:             z.string().trim().min(1).max(200),
  description:       z.string().trim().max(2000).optional().or(z.literal('')),
  requires_document: z.boolean().optional().default(false),
})

async function loadCtx(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string,
) {
  const scope = await getScope(supabase)
  if (!scope) return { error: 'Forbidden', status: 403 as const }
  if (scope.departmentIds !== 'all' && !scope.departmentIds.includes(departmentId)) {
    return { error: 'Forbidden', status: 403 as const }
  }

  const svc = createServiceClient()
  const { data: dept } = await svc
    .from('departments')
    .select('id, name, institution_id')
    .eq('id', departmentId)
    .maybeSingle()
  if (!dept || dept.institution_id !== scope.institutionId) {
    return { error: 'Department not found', status: 404 as const }
  }

  const { data: workspace } = await svc
    .from('workspaces')
    .select('id')
    .eq('institution_id', scope.institutionId)
    .eq('type', 'institutional')
    .maybeSingle()
  if (!workspace) return { error: 'No institutional workspace', status: 500 as const }

  return { scope, svc, dept, workspace }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const loaded = await loadCtx(supabase, id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  const { svc, workspace } = loaded
  const { data, error } = await svc
    .from('milestone_templates')
    .select('id, title, description, order_index, requires_document, created_at, updated_at, created_by, creator:profiles!created_by(full_name, email)')
    .eq('workspace_id', workspace.id)
    .eq('department_id', id)
    .order('order_index', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const loaded = await loadCtx(supabase, id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { scope, svc, dept, workspace } = loaded

  // New templates go at the end. Skip a 'count' round-trip — just read the
  // current max order_index for this dept.
  const { data: existing } = await svc
    .from('milestone_templates')
    .select('order_index')
    .eq('workspace_id', workspace.id)
    .eq('department_id', id)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = ((existing?.order_index as number | undefined) ?? -1) + 1

  const { data: inserted, error: insertErr } = await svc
    .from('milestone_templates')
    .insert({
      workspace_id: workspace.id,
      department_id: id,
      created_by: scope.userId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      requires_document: parsed.data.requires_document ?? false,
      order_index: nextOrder,
    })
    .select('id, title, order_index')
    .single()
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  void writeAuditEntry({
    actor_id: scope.userId,
    action: 'institution.admin.updated',
    resource_type: 'institution',
    resource_id: scope.institutionId,
    institution_id: scope.institutionId,
    details: {
      summary: `Added milestone stage "${inserted.title}" to ${dept.name}`,
      department_id: id,
      template_id: inserted.id,
    },
  })

  return NextResponse.json({ success: true, template: inserted })
}

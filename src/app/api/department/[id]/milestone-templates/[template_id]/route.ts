import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getScope } from '@/lib/admin/scope'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 *   PATCH  — edit title/description/requires_document, or move up/down
 *            via { direction: 'up' | 'down' } (swaps order_index with the
 *            adjacent template)
 *   DELETE — delete the template. Existing student_milestones detach via
 *            ON DELETE SET NULL — historical records stay intact.
 */

const patchSchema = z.union([
  z.object({
    title:             z.string().trim().min(1).max(200).optional(),
    description:       z.string().trim().max(2000).optional().or(z.literal('')),
    requires_document: z.boolean().optional(),
  }),
  z.object({ direction: z.enum(['up', 'down']) }),
])

async function loadCtx(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string,
  templateId: string,
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

  const { data: template } = await svc
    .from('milestone_templates')
    .select('id, title, order_index, department_id, workspace_id')
    .eq('id', templateId)
    .maybeSingle()
  if (!template || template.department_id !== departmentId || template.workspace_id !== workspace.id) {
    return { error: 'Template not found', status: 404 as const }
  }

  return { scope, svc, dept, workspace, template }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; template_id: string }> },
) {
  const { id, template_id } = await params
  const supabase = await createClient()
  const loaded = await loadCtx(supabase, id, template_id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { scope, svc, dept, workspace, template } = loaded

  // Reorder (swap with neighbor)
  if ('direction' in parsed.data) {
    const cmp = parsed.data.direction === 'up' ? 'lt' : 'gt'
    const sortDir = parsed.data.direction === 'up' ? false : true
    const { data: neighbor } = await svc
      .from('milestone_templates')
      .select('id, order_index')
      .eq('workspace_id', workspace.id)
      .eq('department_id', id)
      .filter('order_index', cmp, template.order_index)
      .order('order_index', { ascending: sortDir })
      .limit(1)
      .maybeSingle()

    if (!neighbor) {
      return NextResponse.json({ error: 'Already at the edge' }, { status: 409 })
    }

    // Two-step swap to avoid colliding with any UNIQUE constraints if added
    // later. Move the moving template to a temporary value first.
    const tmp = -1 * (template.order_index as number) - 1000
    const { error: e1 } = await svc.from('milestone_templates').update({ order_index: tmp }).eq('id', template.id)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    const { error: e2 } = await svc.from('milestone_templates').update({ order_index: template.order_index }).eq('id', neighbor.id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    const { error: e3 } = await svc.from('milestone_templates').update({ order_index: neighbor.order_index }).eq('id', template.id)
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })

    return NextResponse.json({ success: true })
  }

  // Field edits
  const update: Record<string, unknown> = {}
  if ('title' in parsed.data && parsed.data.title !== undefined)             update.title = parsed.data.title
  if ('description' in parsed.data && parsed.data.description !== undefined) update.description = parsed.data.description || null
  if ('requires_document' in parsed.data && parsed.data.requires_document !== undefined) update.requires_document = parsed.data.requires_document
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: true, noop: true })
  }

  const { error: updateErr } = await svc
    .from('milestone_templates')
    .update(update)
    .eq('id', template.id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  void writeAuditEntry({
    actor_id: scope.userId,
    action: 'institution.admin.updated',
    resource_type: 'institution',
    resource_id: scope.institutionId,
    institution_id: scope.institutionId,
    details: {
      summary: `Edited milestone stage "${template.title}" in ${dept.name}`,
      department_id: id,
      template_id: template.id,
      changed_fields: Object.keys(update),
    },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; template_id: string }> },
) {
  const { id, template_id } = await params
  const supabase = await createClient()
  const loaded = await loadCtx(supabase, id, template_id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  const { scope, svc, dept, template } = loaded

  const { error } = await svc
    .from('milestone_templates')
    .delete()
    .eq('id', template.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void writeAuditEntry({
    actor_id: scope.userId,
    action: 'institution.admin.updated',
    resource_type: 'institution',
    resource_id: scope.institutionId,
    institution_id: scope.institutionId,
    details: {
      summary: `Removed milestone stage "${template.title}" from ${dept.name}`,
      department_id: id,
      template_id: template.id,
    },
  })

  return NextResponse.json({ success: true })
}

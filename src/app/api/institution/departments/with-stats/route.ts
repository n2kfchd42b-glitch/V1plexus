import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'

/**
 * GET /api/institution/departments/with-stats
 *
 * Departments in the caller's institution, each enriched with:
 *   - heads:          workspace_memberships rows with role='department_head'
 *                     scoped to that department_id (the federated-admin model)
 *   - supervisor_count, student_count: from supervisor_assignments + the
 *                     institutional workspace membership roll
 *
 * Used by the Departments management page. Institution admins only.
 */
export async function GET() {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()

  const { data: workspace } = await svc
    .from('workspaces')
    .select('id, name')
    .eq('institution_id', ctx.institutionId)
    .eq('type', 'institutional')
    .maybeSingle()

  const { data: departments, error: deptErr } = await svc
    .from('departments')
    .select('id, name, description, head_id, created_at')
    .eq('institution_id', ctx.institutionId)
    .order('name', { ascending: true })

  if (deptErr) return NextResponse.json({ error: deptErr.message }, { status: 500 })

  const deptIds = (departments ?? []).map(d => d.id as string)
  if (deptIds.length === 0) {
    return NextResponse.json({ workspace, departments: [] })
  }

  // Fetch heads (workspace_memberships with role='department_head'), supervisor
  // counts (per dept from supervisor_assignments) and student counts (from
  // memberships role='student' scoped by department_id).
  const [headsRes, supRes, studentRes] = await Promise.all([
    workspace
      ? svc
          .from('workspace_memberships')
          .select(`
            user_id, department_id,
            user:profiles!workspace_memberships_user_id_fkey(id, full_name, email, avatar_url, title)
          `)
          .eq('workspace_id', workspace.id)
          .eq('role', 'department_head')
          .eq('status', 'active')
          .in('department_id', deptIds)
      : Promise.resolve({ data: [] }),
    svc
      .from('supervisor_assignments')
      .select('department_id, supervisor_id')
      .in('department_id', deptIds)
      .eq('status', 'active'),
    workspace
      ? svc
          .from('workspace_memberships')
          .select('department_id, user_id')
          .eq('workspace_id', workspace.id)
          .eq('role', 'student')
          .eq('status', 'active')
          .in('department_id', deptIds)
      : Promise.resolve({ data: [] }),
  ])

  const headsByDept = new Map<string, Array<{ id: string; full_name: string | null; email: string; avatar_url: string | null; title: string | null }>>()
  for (const row of (headsRes.data ?? []) as unknown as Array<{ department_id: string; user: { id: string; full_name: string | null; email: string; avatar_url: string | null; title: string | null } | null }>) {
    if (!row.user || !row.department_id) continue
    const arr = headsByDept.get(row.department_id) ?? []
    arr.push(row.user)
    headsByDept.set(row.department_id, arr)
  }

  const supByDept = new Map<string, Set<string>>()
  for (const row of (supRes.data ?? []) as Array<{ department_id: string; supervisor_id: string }>) {
    const s = supByDept.get(row.department_id) ?? new Set<string>()
    s.add(row.supervisor_id)
    supByDept.set(row.department_id, s)
  }

  const studentByDept = new Map<string, Set<string>>()
  for (const row of (studentRes.data ?? []) as Array<{ department_id: string; user_id: string }>) {
    const s = studentByDept.get(row.department_id) ?? new Set<string>()
    s.add(row.user_id)
    studentByDept.set(row.department_id, s)
  }

  const result = (departments ?? []).map(d => ({
    id: d.id as string,
    name: d.name as string,
    description: (d.description as string | null) ?? null,
    head_id: (d.head_id as string | null) ?? null,
    created_at: d.created_at as string,
    heads: headsByDept.get(d.id as string) ?? [],
    supervisor_count: supByDept.get(d.id as string)?.size ?? 0,
    student_count: studentByDept.get(d.id as string)?.size ?? 0,
  }))

  return NextResponse.json({ workspace, departments: result })
}

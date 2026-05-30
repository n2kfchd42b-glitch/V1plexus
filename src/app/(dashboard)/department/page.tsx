import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getScope } from '@/lib/admin/scope'

/**
 * Smart entry point for /department. Routes the caller based on what they
 * are:
 *
 *   - Institution admin / owner          → /institution/departments
 *                                           (they manage all departments)
 *   - Department head of exactly one     → /department/[id] for that dept
 *   - Department head of multiple        → /department/[id] for the first
 *                                           (picker UI deferred)
 *   - Anyone else                        → / (no permission)
 */
export default async function DepartmentRouter() {
  const supabase = await createClient()
  const scope = await getScope(supabase)

  if (!scope) redirect('/')

  if (scope.isInstitutionAdmin) {
    redirect('/institution/departments')
  }

  if (scope.isDepartmentHead && scope.departmentIds !== 'all' && scope.departmentIds.length > 0) {
    redirect(`/department/${scope.departmentIds[0]}`)
  }

  redirect('/')
}

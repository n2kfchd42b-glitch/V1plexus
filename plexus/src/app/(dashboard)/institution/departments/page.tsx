import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { DepartmentCard } from '@/components/institution/DepartmentCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'

export default async function DepartmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single()

  const institutionId = profile?.institution_id
  if (!institutionId) redirect('/institution')

  const { data: departments } = await supabase
    .from('departments')
    .select('*')
    .eq('institution_id', institutionId)
    .is('deleted_at', null)
    .order('name')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="All departments in your institution"
      />

      {!departments || departments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No departments"
          description="No departments have been set up for your institution yet."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <DepartmentCard key={dept.id} department={dept} />
          ))}
        </div>
      )}
    </div>
  )
}

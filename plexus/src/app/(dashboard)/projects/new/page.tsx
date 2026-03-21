import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateProjectForm } from '@/components/project/CreateProjectForm'
import type { Tables } from '@/types/database'

export default async function NewProjectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single()

  const institutionId = profile?.institution_id
  let departments: Tables<'departments'>[] = []

  if (institutionId) {
    const { data } = await supabase
      .from('departments')
      .select('*')
      .eq('institution_id', institutionId)
      .is('deleted_at', null)
      .order('name')
    departments = (data as Tables<'departments'>[]) ?? []
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A202C]">New project</h1>
        <p className="text-[#718096] mt-1">Create a new research project</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
          <CardDescription>Fill in the information about your research project</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateProjectForm departments={departments} />
        </CardContent>
      </Card>
    </div>
  )
}

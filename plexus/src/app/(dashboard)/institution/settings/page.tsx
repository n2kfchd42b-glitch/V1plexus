import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'

export default async function InstitutionSettingsPage() {
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

  const { data: institution } = await supabase
    .from('institutions')
    .select('*')
    .eq('id', institutionId)
    .single()

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Institution settings" />
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Institution details and configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-[#718096]">Institution name</p>
            <p className="text-[#1A202C]">{institution?.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-[#718096]">Slug</p>
            <p className="text-[#1A202C] font-mono text-sm">{institution?.slug}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

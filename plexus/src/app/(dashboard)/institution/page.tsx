import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, Users, FolderOpen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'

export default async function InstitutionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single()

  const institutionId = profile?.institution_id

  if (!institutionId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Institution" description="You are not affiliated with an institution yet." />
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 text-[#A0AEC0] mx-auto mb-4" />
            <h3 className="text-base font-semibold text-[#1A202C] mb-2">No institution</h3>
            <p className="text-sm text-[#718096] max-w-sm mx-auto">
              You haven&apos;t been assigned to an institution. Contact your institution admin to be added.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: institution } = await supabase
    .from('institutions')
    .select('*')
    .eq('id', institutionId)
    .single()

  // Fetch department IDs first, then count projects
  const { data: deptRows } = await supabase
    .from('departments')
    .select('id')
    .eq('institution_id', institutionId)
    .is('deleted_at', null)

  const deptCount = deptRows?.length ?? 0
  const deptIds = deptRows?.map((d) => d.id) ?? []

  const [{ count: memberCount }, { count: projectCount }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId),
    deptIds.length > 0
      ? supabase.from('projects').select('*', { count: 'exact', head: true }).in('department_id', deptIds).is('deleted_at', null)
      : Promise.resolve({ count: 0 }),
  ])

  return (
    <div className="space-y-8">
      <PageHeader
        title={institution?.name ?? 'Institution'}
        description="Institution overview and management"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/institution/members">Manage members</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/institution/departments">Departments</Link>
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-[#D5E8F0] flex items-center justify-center">
                <Users className="h-5 w-5 text-[#2E75B6]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1A202C]">{memberCount ?? 0}</p>
                <p className="text-sm text-[#718096]">Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-[#D5E8F0] flex items-center justify-center">
                <Building2 className="h-5 w-5 text-[#2E75B6]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1A202C]">{deptCount}</p>
                <p className="text-sm text-[#718096]">Departments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-[#D5E8F0] flex items-center justify-center">
                <FolderOpen className="h-5 w-5 text-[#2E75B6]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1A202C]">{projectCount ?? 0}</p>
                <p className="text-sm text-[#718096]">Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Button asChild variant="outline">
          <Link href="/institution/departments">View departments</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/institution/members">View members</Link>
        </Button>
      </div>
    </div>
  )
}

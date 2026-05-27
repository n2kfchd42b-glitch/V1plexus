import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'

export default async function InstitutionLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) redirect('/projects')
  return <>{children}</>
}

import { redirect } from 'next/navigation'
import { INSTITUTION_ENABLED } from '@/lib/flags'

export default function DepartmentLayout({ children }: { children: React.ReactNode }) {
  if (!INSTITUTION_ENABLED) redirect('/projects')
  return <>{children}</>
}

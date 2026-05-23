import { redirect } from 'next/navigation'
import { REVIEWS_ENABLED } from '@/lib/flags'

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  if (!REVIEWS_ENABLED) redirect('/projects')
  return <>{children}</>
}

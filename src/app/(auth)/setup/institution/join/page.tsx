"use client"

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { InstitutionJoinSearch } from '@/components/auth/InstitutionJoinSearch'
import { InstitutionJoinForm } from '@/components/auth/InstitutionJoinForm'

function JoinContent() {
  const searchParams = useSearchParams()
  const institutionId = searchParams.get('id')

  if (institutionId) {
    return <InstitutionJoinForm institutionId={institutionId} />
  }
  return <InstitutionJoinSearch />
}

export default function InstitutionJoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <JoinContent />
    </Suspense>
  )
}

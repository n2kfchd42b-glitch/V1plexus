"use client"

export const dynamic = 'force-dynamic'

import { use } from 'react'
import { InvitationAccept } from '@/components/auth/InvitationAccept'

interface PageProps {
  params: Promise<{ token: string }>
}

export default function InvitePage({ params }: PageProps) {
  const { token } = use(params)
  return <InvitationAccept token={token} />
}

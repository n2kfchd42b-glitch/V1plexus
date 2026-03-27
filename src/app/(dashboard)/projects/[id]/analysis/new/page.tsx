"use client"

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function NewAnalysisPage() {
  const params = useParams()
  const router = useRouter()
  useEffect(() => {
    router.replace(`/projects/${params.id}/analysis`)
  }, [params.id, router])
  return null
}

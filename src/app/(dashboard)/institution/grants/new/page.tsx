'use client'

import { INSTITUTIONAL_INTELLIGENCE_ENABLED } from '@/lib/flags'
import { GrantForm } from '@/components/grants/GrantForm'
import { redirect } from 'next/navigation'

export default function NewGrantPage() {
  if (!INSTITUTIONAL_INTELLIGENCE_ENABLED) {
    redirect('/institution/grants')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">New Grant</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
          Add a funding grant to track projects and reporting deadlines
        </p>
      </div>
      <GrantForm />
    </div>
  )
}

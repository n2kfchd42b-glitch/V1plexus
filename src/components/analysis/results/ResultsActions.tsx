"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Save, Loader2, Check } from 'lucide-react'

interface Props {
  onSave: () => Promise<void>
  saved?: boolean
}

export function ResultsActions({ onSave, saved }: Props) {
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(saved ?? false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave()
      setDone(true)
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#166534] bg-[#F0FDF4] border border-[#E4E4E7] rounded-lg px-4 py-2 cursor-default"
      >
        <Check className="h-3.5 w-3.5" />
        Saved
      </button>
    )
  }

  return (
    <Button
      size="sm"
      onClick={handleSave}
      disabled={saving}
      className="bg-[#0052CC] hover:bg-[#003D9B] text-white font-semibold rounded-lg transition-colors duration-150"
    >
      {saving
        ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        : <Save className="h-3.5 w-3.5 mr-1.5" />}
      Save Results
    </Button>
  )
}

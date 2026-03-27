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

  return (
    <Button
      size="sm"
      variant={done ? 'outline' : 'default'}
      onClick={handleSave}
      disabled={saving || done}
      className={`rounded-xl px-4 py-2.5 font-medium ${done ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-50' : 'shadow-lg shadow-primary/20'}`}
    >
      {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        : done ? <Check className="h-4 w-4 mr-1.5" />
        : <Save className="h-4 w-4 mr-1.5" />}
      {done ? 'Saved' : 'Save Results'}
    </Button>
  )
}

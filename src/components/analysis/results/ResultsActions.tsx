"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Save, FileText, BarChart2, Loader2, Check } from 'lucide-react'

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
    <div className="flex items-center gap-2 pt-3 border-t">
      <Button size="sm" variant="default" onClick={handleSave} disabled={saving || done}>
        {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          : done ? <Check className="h-3.5 w-3.5 mr-1.5" />
          : <Save className="h-3.5 w-3.5 mr-1.5" />}
        {done ? 'Saved' : 'Save Results'}
      </Button>
    </div>
  )
}

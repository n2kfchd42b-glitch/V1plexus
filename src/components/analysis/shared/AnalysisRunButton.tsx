"use client"

import { Button } from '@/components/ui/button'
import { Play, Loader2 } from 'lucide-react'

interface AnalysisRunButtonProps {
  onClick: () => void
  loading: boolean
  disabled?: boolean
}

export function AnalysisRunButton({ onClick, loading, disabled }: AnalysisRunButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full mt-4"
      size="sm"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Running analysis…
        </>
      ) : (
        <>
          <Play className="h-4 w-4 mr-2" />
          Run Analysis
        </>
      )}
    </Button>
  )
}

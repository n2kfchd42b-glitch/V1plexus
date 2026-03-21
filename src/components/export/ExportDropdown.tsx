"use client"

import { useState } from 'react'
import { Download, FileText, File, Code, ChevronDown, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'

interface ExportDropdownProps {
  documentId: string
  documentTitle: string
}

type ExportFormat = 'docx' | 'pdf' | 'latex'
type ExportState = 'idle' | 'loading' | 'success' | 'error'

const formatOptions: { format: ExportFormat; label: string; ext: string; icon: React.ElementType; description: string }[] = [
  { format: 'docx', label: 'Word (.docx)', ext: 'docx', icon: FileText, description: 'For sharing with supervisors' },
  { format: 'pdf', label: 'PDF', ext: 'pdf', icon: File, description: 'For archival and submission' },
  { format: 'latex', label: 'LaTeX (.tex)', ext: 'tex', icon: Code, description: 'For journal submission' },
]

export function ExportDropdown({ documentId, documentTitle }: ExportDropdownProps) {
  const [states, setStates] = useState<Record<ExportFormat, ExportState>>({
    docx: 'idle',
    pdf: 'idle',
    latex: 'idle',
  })
  const supabase = createClient()

  const handleExport = async (format: ExportFormat, ext: string) => {
    setStates(prev => ({ ...prev, [format]: 'loading' }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/export-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ document_id: documentId, format }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error ?? 'Export failed')
      }

      const { download_url } = await response.json()

      // Trigger browser download
      const a = window.document.createElement('a')
      a.href = download_url
      a.download = `${documentTitle.replace(/[^a-z0-9]/gi, '_')}.${ext}`
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)

      setStates(prev => ({ ...prev, [format]: 'success' }))
      setTimeout(() => setStates(prev => ({ ...prev, [format]: 'idle' })), 3000)
    } catch (err) {
      console.error('Export error:', err)
      setStates(prev => ({ ...prev, [format]: 'error' }))
      setTimeout(() => setStates(prev => ({ ...prev, [format]: 'idle' })), 3000)
    }
  }

  const anyLoading = Object.values(states).some(s => s === 'loading')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" disabled={anyLoading}>
          {anyLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          Download as
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formatOptions.map(({ format, label, ext, icon: Icon, description }) => {
          const state = states[format]
          return (
            <DropdownMenuItem
              key={format}
              onClick={() => handleExport(format, ext)}
              disabled={state === 'loading'}
              className="flex items-start gap-3 py-2.5 cursor-pointer"
            >
              <div className="mt-0.5">
                {state === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : state === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : state === 'error' ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <Icon className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium leading-none mb-0.5">
                  {state === 'success' ? 'Downloaded!' : state === 'error' ? 'Export failed' : label}
                </p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

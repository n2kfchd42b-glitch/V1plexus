"use client"

import { useMemo, useState } from 'react'
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
  { format: 'pdf', label: 'PDF (Print)', ext: 'pdf', icon: File, description: 'Opens print dialog — Save as PDF' },
  { format: 'latex', label: 'LaTeX (.tex)', ext: 'tex', icon: Code, description: 'For journal submission' },
]

// ─── Client-side PDF helpers ─────────────────────────────────────────────────

function escHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function nodeToHtml(node: Record<string, unknown>): string {
  if (node.type === 'text') {
    let text = escHtml((node.text as string) ?? '')
    const marks = (node.marks as Record<string, unknown>[] | undefined) ?? []
    for (const mark of marks) {
      if (mark.type === 'bold') text = `<strong>${text}</strong>`
      if (mark.type === 'italic') text = `<em>${text}</em>`
      if (mark.type === 'underline') text = `<u>${text}</u>`
      if (mark.type === 'code') text = `<code>${text}</code>`
    }
    return text
  }
  const children = (node.content as Record<string, unknown>[] | undefined) ?? []
  const inner = children.map(nodeToHtml).join('')
  switch (node.type) {
    case 'paragraph': return `<p>${inner || '&nbsp;'}</p>`
    case 'heading': {
      const lvl = (node.attrs as Record<string, unknown>)?.level ?? 1
      return `<h${lvl}>${inner}</h${lvl}>`
    }
    case 'bulletList': return `<ul>${inner}</ul>`
    case 'orderedList': return `<ol>${inner}</ol>`
    case 'listItem': return `<li>${inner}</li>`
    case 'blockquote': return `<blockquote>${inner}</blockquote>`
    case 'codeBlock': return `<pre><code>${inner}</code></pre>`
    case 'hardBreak': return '<br>'
    case 'horizontalRule': return '<hr>'
    default: return inner
  }
}

function buildPrintHtml(title: string, content: Record<string, unknown> | null): string {
  const body = content ? nodeToHtml(content) : ''
  return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>${escHtml(title)}</title>
  <style>
    body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.6;color:#222}
    h1,h2,h3{margin-top:1.5em}p{margin:.5em 0}
    pre{background:#f5f5f5;padding:12px;border-radius:4px;overflow-x:auto}
    blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:16px;color:#555}
    @media print{body{margin:0}@page{margin:2cm}}
  </style>
</head>
<body>
  <h1>${escHtml(title)}</h1>
  ${body}
</body></html>`
}

// ─────────────────────────────────────────────────────────────────────────────

export function ExportDropdown({ documentId, documentTitle }: ExportDropdownProps) {
  const [states, setStates] = useState<Record<ExportFormat, ExportState>>({
    docx: 'idle',
    pdf: 'idle',
    latex: 'idle',
  })
  const supabase = useMemo(() => createClient(), [])

  const handleExport = async (format: ExportFormat, ext: string) => {
    setStates(prev => ({ ...prev, [format]: 'loading' }))
    try {
      // PDF — open a styled HTML page and trigger the browser's print/Save as PDF dialog
      if (format === 'pdf') {
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .select('title, content')
          .eq('id', documentId)
          .single()
        if (docError || !doc) throw new Error('Document not found')
        const html = buildPrintHtml(
          doc.title as string,
          doc.content as Record<string, unknown> | null
        )
        const printWindow = window.open('', '_blank')
        if (!printWindow) throw new Error('Popup blocked — please allow popups for this site')
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
        setStates(prev => ({ ...prev, [format]: 'success' }))
        setTimeout(() => setStates(prev => ({ ...prev, [format]: 'idle' })), 3000)
        return
      }

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

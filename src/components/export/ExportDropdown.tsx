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
  { format: 'docx', label: 'Word (.doc)', ext: 'doc', icon: FileText, description: 'Open in Microsoft Word or Google Docs' },
  { format: 'pdf', label: 'PDF (Print)', ext: 'pdf', icon: File, description: 'Opens print dialog — Save as PDF' },
  { format: 'latex', label: 'LaTeX (.tex)', ext: 'tex', icon: Code, description: 'For journal submission' },
]

// ─── HTML escaping ────────────────────────────────────────────────────────────

function escHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─── TipTap JSON → HTML ───────────────────────────────────────────────────────

function nodeToHtml(node: Record<string, unknown>): string {
  if (node.type === 'text') {
    let text = escHtml((node.text as string) ?? '')
    const marks = (node.marks as Record<string, unknown>[] | undefined) ?? []
    for (const mark of marks) {
      if (mark.type === 'bold') text = `<strong>${text}</strong>`
      if (mark.type === 'italic') text = `<em>${text}</em>`
      if (mark.type === 'underline') text = `<u>${text}</u>`
      if (mark.type === 'strike') text = `<s>${text}</s>`
      if (mark.type === 'code') text = `<code>${text}</code>`
    }
    return text
  }
  const children = (node.content as Record<string, unknown>[] | undefined) ?? []
  const inner = children.map(nodeToHtml).join('')
  switch (node.type) {
    case 'doc': return inner
    case 'paragraph': return `<p>${inner || '&nbsp;'}</p>\n`
    case 'heading': {
      const lvl = (node.attrs as Record<string, unknown>)?.level ?? 1
      return `<h${lvl}>${inner}</h${lvl}>\n`
    }
    case 'bulletList': return `<ul>${inner}</ul>\n`
    case 'orderedList': return `<ol>${inner}</ol>\n`
    case 'listItem': return `<li>${inner}</li>\n`
    case 'blockquote': return `<blockquote>${inner}</blockquote>\n`
    case 'codeBlock': return `<pre><code>${inner}</code></pre>\n`
    case 'hardBreak': return '<br>\n'
    case 'horizontalRule': return '<hr>\n'
    default: return inner
  }
}

// ─── PDF: styled HTML print window ───────────────────────────────────────────

function buildPrintHtml(title: string, content: Record<string, unknown> | null): string {
  const body = content ? nodeToHtml(content) : ''
  return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>${escHtml(title)}</title>
  <style>
    body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.6;color:#222}
    h1,h2,h3{margin-top:1.5em;font-family:system-ui,sans-serif}
    p{margin:.5em 0}
    pre{background:#f5f5f5;padding:12px;border-radius:4px;overflow-x:auto}
    blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:16px;color:#555}
    code{background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:.9em}
    @media print{body{margin:0}@page{margin:2cm}}
  </style>
</head>
<body>
  <h1>${escHtml(title)}</h1>
  ${body}
</body></html>`
}

// ─── DOCX: Word-compatible HTML (Word opens .doc HTML natively) ───────────────

function buildWordHtml(title: string, content: Record<string, unknown> | null): string {
  const body = content ? nodeToHtml(content) : ''
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
     xmlns:w="urn:schemas-microsoft-com:office:word"
     xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <title>${escHtml(title)}</title>
  <!--[if gte mso 9]><xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml><![endif]-->
  <style>
    body{font-family:Calibri,sans-serif;font-size:12pt;line-height:1.6;margin:2cm}
    h1{font-size:20pt;font-weight:bold;margin-top:24pt;margin-bottom:6pt}
    h2{font-size:16pt;font-weight:bold;margin-top:18pt;margin-bottom:6pt}
    h3{font-size:13pt;font-weight:bold;margin-top:12pt;margin-bottom:4pt}
    p{margin:0 0 8pt}
    ul,ol{margin:0 0 8pt;padding-left:20pt}
    li{margin-bottom:4pt}
    blockquote{margin-left:24pt;color:#555;font-style:italic;border-left:3pt solid #ccc;padding-left:12pt}
    pre,code{font-family:Courier New,monospace;font-size:10pt;background:#f5f5f5}
    pre{padding:8pt;border:1pt solid #ddd;margin-bottom:8pt}
    hr{border:none;border-top:1pt solid #ccc;margin:12pt 0}
    strong{font-weight:bold} em{font-style:italic} u{text-decoration:underline}
  </style>
</head>
<body>
  <h1>${escHtml(title)}</h1>
  ${body}
</body>
</html>`
}

// ─── LaTeX ────────────────────────────────────────────────────────────────────

function escLatex(str: string): string {
  return str
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
}

function nodeToLatex(node: Record<string, unknown>): string {
  if (node.type === 'text') {
    let text = escLatex((node.text as string) ?? '')
    const marks = (node.marks as Record<string, unknown>[] | undefined) ?? []
    for (const mark of marks) {
      if (mark.type === 'bold') text = `\\textbf{${text}}`
      if (mark.type === 'italic') text = `\\textit{${text}}`
      if (mark.type === 'underline') text = `\\underline{${text}}`
      if (mark.type === 'code') text = `\\texttt{${text}}`
    }
    return text
  }
  const children = (node.content as Record<string, unknown>[] | undefined) ?? []
  const inner = children.map(nodeToLatex).join('')
  switch (node.type) {
    case 'doc': return inner
    case 'paragraph': return `\n${inner}\n`
    case 'heading': {
      const lvl = (node.attrs as Record<string, unknown>)?.level ?? 1
      const cmds = ['section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph']
      const cmd = cmds[Math.min((lvl as number) - 1, cmds.length - 1)]
      return `\n\\${cmd}{${inner}}\n`
    }
    case 'bulletList': return `\n\\begin{itemize}\n${inner}\\end{itemize}\n`
    case 'orderedList': return `\n\\begin{enumerate}\n${inner}\\end{enumerate}\n`
    case 'listItem': return `  \\item ${inner}\n`
    case 'blockquote': return `\n\\begin{quote}\n${inner}\\end{quote}\n`
    case 'codeBlock': return `\n\\begin{verbatim}\n${(node.content as Record<string, unknown>[] | undefined)?.map(c => (c.text as string) ?? '').join('') ?? ''}\n\\end{verbatim}\n`
    case 'hardBreak': return '\\\\\n'
    case 'horizontalRule': return '\n\\hrule\n'
    default: return inner
  }
}

function buildLatex(title: string, content: Record<string, unknown> | null): string {
  const body = content ? nodeToLatex(content) : ''
  return `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{hyperref}
\\usepackage{geometry}
\\geometry{margin=2.5cm}
\\title{${escLatex(title)}}
\\date{\\today}
\\begin{document}
\\maketitle
${body}
\\end{document}
`
}

// ─── Download helper ──────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = window.document.createElement('a')
  a.href = url
  a.download = filename
  window.document.body.appendChild(a)
  a.click()
  window.document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────

export function ExportDropdown({ documentId, documentTitle }: ExportDropdownProps) {
  const [states, setStates] = useState<Record<ExportFormat, ExportState>>({
    docx: 'idle',
    pdf: 'idle',
    latex: 'idle',
  })
  const supabase = useMemo(() => createClient(), [])

  const safeTitle = documentTitle.replace(/[^a-z0-9\-_\s]/gi, '').trim() || 'document'

  const handleExport = async (format: ExportFormat) => {
    setStates(prev => ({ ...prev, [format]: 'loading' }))
    try {
      // Fetch document content from Supabase
      const { data: doc, error } = await supabase
        .from('documents')
        .select('title, content')
        .eq('id', documentId)
        .single()

      if (error || !doc) throw new Error('Could not load document content')

      const title = (doc.title as string) ?? documentTitle
      const content = doc.content as Record<string, unknown> | null

      if (format === 'pdf') {
        const html = buildPrintHtml(title, content)
        const printWindow = window.open('', '_blank')
        if (!printWindow) throw new Error('Popup blocked — please allow popups for this site')
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => printWindow.print(), 250)
      } else if (format === 'docx') {
        const html = buildWordHtml(title, content)
        downloadBlob(html, `${safeTitle}.doc`, 'application/msword')
      } else if (format === 'latex') {
        const tex = buildLatex(title, content)
        downloadBlob(tex, `${safeTitle}.tex`, 'application/x-latex')
      }

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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          Download as
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formatOptions.map(({ format, label, icon: Icon, description }) => {
          const state = states[format]
          return (
            <DropdownMenuItem
              key={format}
              onClick={() => handleExport(format)}
              disabled={state === 'loading'}
              className="flex items-start gap-3 py-2.5 cursor-pointer"
            >
              <div className="mt-0.5 flex-shrink-0">
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
                  {state === 'success' ? 'Downloaded!' : state === 'error' ? 'Export failed — try again' : label}
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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'http://localhost:3000'

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

// Convert TipTap JSON nodes to plain text (for docx/pdf content)
function tiptapToText(content: Record<string, unknown> | null): string {
  if (!content) return ''

  function extractText(node: Record<string, unknown>): string {
    if (node.type === 'text') return (node.text as string) ?? ''

    const children = (node.content as Record<string, unknown>[] | undefined) ?? []
    const childText = children.map(c => extractText(c)).join('')

    switch (node.type) {
      case 'heading': return `\n\n${childText}\n\n`
      case 'paragraph': return `\n${childText}\n`
      case 'bulletList':
      case 'orderedList': return `\n${childText}\n`
      case 'listItem': return `  • ${childText}\n`
      case 'blockquote': return `\n> ${childText}\n`
      case 'codeBlock': return `\n\`\`\`\n${childText}\n\`\`\`\n`
      case 'hardBreak': return '\n'
      case 'horizontalRule': return '\n---\n'
      default: return childText
    }
  }

  return extractText(content).trim()
}

// Convert TipTap JSON to LaTeX
function tiptapToLatex(content: Record<string, unknown> | null, title: string): string {
  if (!content) return ''

  function nodeToLatex(node: Record<string, unknown>): string {
    if (node.type === 'text') {
      let text = (node.text as string) ?? ''
      // Escape LaTeX special characters
      text = text
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/[&%$#_{}]/g, c => `\\${c}`)
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}')

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
    const childText = children.map(c => nodeToLatex(c)).join('')

    switch (node.type) {
      case 'heading': {
        const level = (node.attrs as Record<string, unknown>)?.level ?? 1
        const cmds: Record<number, string> = { 1: 'section', 2: 'subsection', 3: 'subsubsection' }
        return `\n\\${cmds[level as number] ?? 'paragraph'}{${childText}}\n`
      }
      case 'paragraph': return childText ? `\n${childText}\n` : '\n'
      case 'bulletList': return `\n\\begin{itemize}\n${childText}\\end{itemize}\n`
      case 'orderedList': return `\n\\begin{enumerate}\n${childText}\\end{enumerate}\n`
      case 'listItem': return `  \\item ${childText}\n`
      case 'blockquote': return `\n\\begin{quote}\n${childText}\\end{quote}\n`
      case 'codeBlock': return `\n\\begin{verbatim}\n${childText}\\end{verbatim}\n`
      case 'hardBreak': return '\\\\\n'
      case 'horizontalRule': return '\n\\noindent\\rule{\\linewidth}{0.4pt}\n'
      default: return childText
    }
  }

  const body = nodeToLatex(content)

  return `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\usepackage{parskip}
\\usepackage{hyperref}
\\geometry{margin=2.5cm}

\\title{${title.replace(/[&%$#_{}]/g, c => `\\${c}`)}}
\\date{\\today}

\\begin{document}
\\maketitle

${body.trim()}

\\end{document}
`
}

// Build a simple DOCX file (Open XML format)
function tiptapToDocx(content: Record<string, unknown> | null, title: string): Uint8Array {
  const text = tiptapToText(content)

  // Build minimal OOXML word document
  const wordXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/></w:pPr>
      <w:r><w:t>${escapeXml(title)}</w:t></w:r>
    </w:p>
    ${text.split('\n').map(line =>
      `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
    ).join('\n    ')}
  </w:body>
</w:document>`

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`

  // Simple ZIP construction for DOCX
  return buildZip([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: relsXml },
    { name: 'word/document.xml', content: wordXml },
  ])
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Minimal ZIP builder (stored, no compression)
function buildZip(files: { name: string; content: string }[]): Uint8Array {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const centralDir: { name: Uint8Array; offset: number; crc: number; size: number }[] = []
  let offset = 0

  function crc32(data: Uint8Array): number {
    const table = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      table[i] = c
    }
    let crc = 0xFFFFFFFF
    for (const byte of data) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
    return (crc ^ 0xFFFFFFFF) >>> 0
  }

  function u16(n: number): Uint8Array {
    return new Uint8Array([n & 0xFF, (n >> 8) & 0xFF])
  }
  function u32(n: number): Uint8Array {
    return new Uint8Array([n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF])
  }

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const dataBytes = encoder.encode(file.content)
    const crc = crc32(dataBytes)
    const size = dataBytes.length

    // Local file header
    const header = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04, // signature
      0x14, 0x00,              // version needed
      0x00, 0x00,              // flags
      0x00, 0x00,              // compression (stored)
      0x00, 0x00, 0x00, 0x00, // mod time/date
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      0x00, 0x00,              // extra field length
    ])

    centralDir.push({ name: nameBytes, offset, crc, size })
    parts.push(header, nameBytes, dataBytes)
    offset += header.length + nameBytes.length + size
  }

  const centralDirOffset = offset
  let centralDirSize = 0

  for (const { name, offset: fileOffset, crc, size } of centralDir) {
    const entry = new Uint8Array([
      0x50, 0x4B, 0x01, 0x02, // central dir signature
      0x14, 0x00,              // version made by
      0x14, 0x00,              // version needed
      0x00, 0x00,              // flags
      0x00, 0x00,              // compression
      0x00, 0x00, 0x00, 0x00, // mod time/date
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(name.length),
      0x00, 0x00,              // extra field length
      0x00, 0x00,              // comment length
      0x00, 0x00,              // disk start
      0x00, 0x00,              // int attrs
      0x00, 0x00, 0x00, 0x00, // ext attrs
      ...u32(fileOffset),
    ])
    parts.push(entry, name)
    centralDirSize += entry.length + name.length
  }

  // End of central directory record
  const eocd = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06,
    0x00, 0x00, 0x00, 0x00,
    ...u16(centralDir.length),
    ...u16(centralDir.length),
    ...u32(centralDirSize),
    ...u32(centralDirOffset),
    0x00, 0x00,
  ])
  parts.push(eocd)

  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const result = new Uint8Array(total)
  let pos = 0
  for (const p of parts) { result.set(p, pos); pos += p.length }
  return result
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { document_id, format } = await req.json()

    if (!document_id || !format) {
      return new Response(JSON.stringify({ error: 'Missing document_id or format' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (!['docx', 'pdf', 'latex'].includes(format)) {
      return new Response(JSON.stringify({ error: 'Invalid format' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Fetch document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, title, content, project_id')
      .eq('id', document_id)
      .single()

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    let fileContent: Uint8Array | string
    let contentType: string
    let extension: string

    if (format === 'docx') {
      fileContent = tiptapToDocx(doc.content as Record<string, unknown>, doc.title)
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      extension = 'docx'
    } else if (format === 'latex') {
      fileContent = tiptapToLatex(doc.content as Record<string, unknown>, doc.title)
      contentType = 'application/x-latex'
      extension = 'tex'
    } else {
      // PDF: generate as HTML content (full PDF generation requires headless browser)
      // We return an HTML file with print styles as a PDF-ready document
      const text = tiptapToText(doc.content as Record<string, unknown>)
      fileContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeXml(doc.title)}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #333; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${escapeXml(doc.title)}</h1>
  ${text.split('\n').map(l => `<p>${escapeXml(l)}</p>`).join('\n  ')}
</body>
</html>`
      contentType = 'text/html'
      extension = 'html'
    }

    // Upload to Supabase Storage
    const fileName = `exports/${user.id}/${document_id}_${Date.now()}.${extension}`
    const uploadData = typeof fileContent === 'string'
      ? new TextEncoder().encode(fileContent)
      : fileContent

    // Ensure bucket exists
    await supabase.storage.createBucket('exports', { public: false }).catch(() => {})

    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(fileName, uploadData, { contentType, upsert: true })

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    // Get signed download URL (valid 1 hour)
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from('exports')
      .createSignedUrl(fileName, 3600)

    if (urlError || !signedUrl) {
      throw new Error('Failed to create download URL')
    }

    return new Response(
      JSON.stringify({ download_url: signedUrl.signedUrl, format, extension }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Export error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SUPPORTED_LANGUAGES: Record<string, string> = {
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
  zh: 'Simplified Chinese',
  ar: 'Arabic',
  hi: 'Hindi',
  ja: 'Japanese',
  ko: 'Korean',
  ru: 'Russian',
  nl: 'Dutch',
  sv: 'Swedish',
  pl: 'Polish',
  tr: 'Turkish',
}

function extractPlainText(node: Record<string, unknown>): string {
  let text = ''
  if (node.type === 'text' && typeof node.text === 'string') text += node.text
  if (Array.isArray(node.content)) {
    for (const child of node.content as Record<string, unknown>[]) {
      text += extractPlainText(child)
    }
  }
  if (['paragraph', 'heading', 'listItem', 'blockquote'].includes(node.type as string)) text += '\n'
  return text
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Translation requires ANTHROPIC_API_KEY to be configured.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { targetLanguage } = await req.json()
  if (!targetLanguage || !SUPPORTED_LANGUAGES[targetLanguage]) {
    return NextResponse.json({ error: 'Unsupported target language' }, { status: 400 })
  }

  // Fetch document content
  const { data: doc, error } = await supabase
    .from('documents')
    .select('title, content')
    .eq('id', documentId)
    .single()

  if (error || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const content = doc.content as Record<string, unknown> | null
  if (!content) return NextResponse.json({ error: 'Document has no content' }, { status: 400 })

  const plainText = extractPlainText(content).trim()
  if (!plainText) return NextResponse.json({ error: 'Document is empty' }, { status: 400 })

  const langName = SUPPORTED_LANGUAGES[targetLanguage]

  // Truncate to ~12k chars to stay within token limits
  const truncated = plainText.length > 12000 ? plainText.slice(0, 12000) + '\n\n[... document truncated for translation preview ...]' : plainText

  const prompt = `You are a professional scientific translator. Translate the following research document text from English into ${langName}.

Preserve:
- All headings, structure, and paragraph breaks
- Scientific terminology accuracy
- Formal academic register
- Numbers, statistics, and proper nouns (leave in original or transliterate as appropriate)

Return ONLY the translated text, preserving the same paragraph/heading structure. Do not add commentary.

DOCUMENT TEXT:
${truncated}`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const translatedText = message.content[0]?.type === 'text' ? message.content[0].text : ''
    if (!translatedText) throw new Error('Empty translation response')

    return NextResponse.json({
      translatedText,
      targetLanguage,
      languageName: langName,
      originalLength: plainText.length,
      wasTruncated: plainText.length > 12000,
    })
  } catch (err) {
    console.error('[translate] Claude error:', err)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ supportedLanguages: SUPPORTED_LANGUAGES })
}

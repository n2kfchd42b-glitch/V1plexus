import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from '@/lib/rateLimit'

const MAX_FIELD_LENGTH = 5000

const SYSTEM_PROMPT = `You are an expert academic writing assistant specializing in cover letters for peer-reviewed journal submissions.

Guidelines:
- Write in formal academic English
- Opening paragraph: identify the manuscript and explain why it suits this specific journal
- Middle paragraphs (2-3): highlight key findings, novelty, and clinical/public health significance
- Note ethical approval if mentioned; confirm no dual submission
- Keep total length to 300-400 words
- Use [PLACEHOLDER] for any missing specifics — never fabricate data or statistics
- Do NOT include date or postal address — start with "Dear Editor,"`

export async function POST(req: NextRequest) {
  const rateLimitResponse = checkRateLimit(req, { limit: 10, windowMs: 60 * 60 * 1000 })
  if (rateLimitResponse) return rateLimitResponse

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { manuscriptTitle, abstract, journalName, authorName, authorAffiliation, additionalContext } = await req.json()

  if (
    (manuscriptTitle?.length ?? 0) > MAX_FIELD_LENGTH ||
    (abstract?.length ?? 0) > MAX_FIELD_LENGTH ||
    (additionalContext?.length ?? 0) > MAX_FIELD_LENGTH
  ) {
    return NextResponse.json({ error: 'Input field exceeds maximum length of 5000 characters.' }, { status: 400 })
  }

  const client = new Anthropic()

  const userPrompt = `Write a cover letter for:
Manuscript: "${manuscriptTitle}"
Journal: "${journalName || '[journal name]'}"
Author: ${authorName || '[author]'}, ${authorAffiliation || '[institution]'}
Abstract: ${abstract || '[not provided]'}
${additionalContext ? `Additional context: ${additionalContext}` : ''}`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const letterBody = message.content[0].type === 'text' ? message.content[0].text : ''
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const letter = `${today}\n\n${letterBody}`

    return NextResponse.json({ letter })
  } catch (err) {
    console.error('Cover letter generation error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}

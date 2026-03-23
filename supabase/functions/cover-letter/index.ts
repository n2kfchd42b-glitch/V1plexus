import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'http://localhost:3000'

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

const SYSTEM_PROMPT = `You are an expert academic writing assistant specializing in cover letters for peer-reviewed journal submissions. Your cover letters are professional, concise, and tailored to specific journals.

Guidelines:
- Write in formal academic English
- Opening paragraph: identify the manuscript and why it suits this specific journal
- Middle paragraph(s): highlight key findings, novelty, and significance (2-3 sentences max per paragraph)
- Note ethical approval if mentioned, and confirm no dual submission
- Keep total length to 300-400 words
- Do NOT fabricate specific statistics or study details not provided — use [PLACEHOLDER] for missing specifics
- Do NOT include the date or address block — just the body starting with "Dear Editor"`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      })
    }

    const { manuscriptTitle, abstract, journalName, authorName, authorAffiliation, additionalContext } = await req.json()

    const userPrompt = `Write a cover letter for the following manuscript submission:

Manuscript title: "${manuscriptTitle}"
Target journal: "${journalName}"
Corresponding author: ${authorName}, ${authorAffiliation}

Abstract:
${abstract || '[Abstract not provided — use placeholders]'}

${additionalContext ? `Additional context:\n${additionalContext}` : ''}

Write only the letter body (starting "Dear Editor,"), ending with the author signature block (name, institution). Do not include date or address.`

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 503, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      })
    }

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text()
      throw new Error(`Anthropic error: ${err}`)
    }

    const data = await anthropicRes.json()
    const letter = data.content?.[0]?.text ?? ''

    // Add date, salutation formatting, and author footer
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const formattedLetter = `${today}\n\n${letter}`

    return new Response(JSON.stringify({ letter: formattedLetter }), {
      status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    })
  }
})

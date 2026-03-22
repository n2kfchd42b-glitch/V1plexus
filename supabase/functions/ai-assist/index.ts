import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = `You are a research writing assistant embedded in PLEXUS, a research platform for global health.
You help researchers write protocols, manuscripts, and theses.

Rules:
- Write in formal academic English suitable for peer-reviewed journals
- Use active voice where possible
- Be precise with statistical terminology
- When generating from analysis outputs, reference specific numbers from the data
- When improving text, preserve the researcher's meaning and voice
- Never fabricate data or statistics
- Format tables in clean academic style (no unnecessary borders, clear headers)
- If asked to generate a section, include [PLACEHOLDER] markers where the researcher needs to fill in specific details you don't have`

// Restrict CORS to the production domain (set ALLOWED_ORIGIN in Supabase Function secrets).
// Falls back to localhost for local development.
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'http://localhost:3000'

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

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

    // Per-user rate limit: max 20 AI requests per hour
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentCount } = await serviceSupabase
      .from('ai_usage_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo)
    if ((recentCount ?? 0) >= 20) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Max 20 AI requests per hour.' }), {
        status: 429, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json', 'Retry-After': '3600' }
      })
    }

    const { action, context, selection, section_type, analysis_output, document_id } = await req.json()

    let userMessage = ''

    switch (action) {
      case 'suggest': {
        const tone = context?.tone ?? 'improve'
        const toneMap: Record<string, string> = {
          improve: 'Improve the following text to make it clearer and more impactful while preserving the author\'s meaning:',
          concise: 'Make the following text more concise while preserving all key information:',
          expand: 'Expand the following text with more detail and elaboration suitable for an academic paper:',
          academic: 'Rewrite the following text in a formal academic tone suitable for a peer-reviewed journal:',
        }
        userMessage = `${toneMap[tone] ?? toneMap.improve}\n\n${selection}\n\nReturn only the improved text, no explanation.`
        break
      }

      case 'generate_section': {
        const sectionMap: Record<string, string> = {
          methods: 'Methods',
          results: 'Results',
          discussion: 'Discussion',
          introduction: 'Introduction',
          abstract: 'Abstract',
        }
        const sectionName = sectionMap[section_type] ?? section_type
        userMessage = `Generate a ${sectionName} section for a research paper based on the following analysis output:\n\n${JSON.stringify(analysis_output, null, 2)}\n\nDocument context:\n${context?.document_text ?? ''}\n\nWrite a complete ${sectionName} section. Use [PLACEHOLDER] for any specific details you cannot determine from the data.`
        break
      }

      case 'format_table': {
        userMessage = `Convert the following analysis output into a well-formatted academic table in APA style. Use plain text with pipes (|) for columns and dashes for separators. Include a descriptive table title and clear column headers.\n\nAnalysis output:\n${JSON.stringify(analysis_output, null, 2)}\n\nReturn only the formatted table.`
        break
      }

      case 'grammar_check': {
        userMessage = `Check the following research text for grammar, clarity, and academic style. Return a JSON array of suggestions, each with fields: "original" (the problematic text), "suggestion" (proposed replacement), "type" ("grammar" | "clarity" | "style"), "explanation" (brief reason). Return only valid JSON.\n\nText:\n${selection ?? context?.document_text}`
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
        })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 503, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      })
    }

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!anthropicRes.ok) {
      const errorBody = await anthropicRes.text()
      console.error('Anthropic API error:', errorBody)
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 502, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      })
    }

    const anthropicData = await anthropicRes.json()
    const resultText = anthropicData.content?.[0]?.text ?? ''
    const inputTokens = anthropicData.usage?.input_tokens ?? 0
    const outputTokens = anthropicData.usage?.output_tokens ?? 0

    // Log AI usage via service role
    await serviceSupabase.from('ai_usage_log').insert({
      user_id: user.id,
      action,
      document_id: document_id ?? null,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      model: 'claude-sonnet-4-6',
    })

    // Trigger audit log for AI usage
    await serviceSupabase.functions.invoke('audit-log', {
      body: {
        action: 'ai.assist',
        resource_type: 'document',
        resource_id: document_id ?? '00000000-0000-0000-0000-000000000000',
        actor_id: user.id,
        details: { ai_action: action, input_tokens: inputTokens, output_tokens: outputTokens },
      },
    })

    let result: unknown = resultText

    if (action === 'grammar_check') {
      try {
        const jsonMatch = resultText.match(/\[[\s\S]*\]/)
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : []
      } catch {
        result = []
      }
    }

    return new Response(JSON.stringify({ result, input_tokens: inputTokens, output_tokens: outputTokens }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('ai-assist error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    })
  }
})

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from '@/lib/rateLimit'
import { createClient } from '@/lib/supabase/server'
import type { AnalysisType } from '@/types/database'
import { AI_ENABLED } from '@/lib/flags'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_FIELD_LENGTH = 5000

export interface SuggestRequest {
  projectTitle: string
  projectDescription?: string | null
  methodology?: string | null
  researchObjectives?: string | null
  columns?: Array<{ name: string; type: string; unique_values?: number; missing?: number }>
}

export interface AnalysisSuggestion {
  type: AnalysisType
  label: string
  reason: string
  confidence: 'high' | 'medium' | 'low'
  priority: number
}

const ANALYSIS_CATALOGUE = [
  { type: 'descriptive', label: 'Descriptive Statistics', tags: ['exploratory', 'summary', 'continuous', 'numeric'] },
  { type: 'frequency', label: 'Frequency Tables', tags: ['categorical', 'count', 'distribution', 'prevalence'] },
  { type: 'chi_square', label: 'Chi-Square Test', tags: ['categorical', 'association', 'independence', 'proportion'] },
  { type: 't_test', label: 'T-Test', tags: ['mean comparison', 'two groups', 'continuous', 'intervention'] },
  { type: 'anova', label: 'ANOVA', tags: ['mean comparison', 'three or more groups', 'factorial'] },
  { type: 'correlation', label: 'Correlation', tags: ['relationship', 'association', 'continuous', 'scatter'] },
  { type: 'simple_regression', label: 'Simple Linear Regression', tags: ['prediction', 'one predictor', 'continuous outcome'] },
  { type: 'multiple_regression', label: 'Multiple Regression', tags: ['prediction', 'confounding', 'multivariate', 'continuous outcome'] },
  { type: 'logistic_regression', label: 'Logistic Regression', tags: ['binary outcome', 'odds ratio', 'risk', 'prediction'] },
  { type: 'multinomial_regression', label: 'Multinomial Regression', tags: ['multi-class outcome', 'categorical outcome'] },
  { type: 'ordinal_regression', label: 'Ordinal Regression', tags: ['ordered outcome', 'Likert', 'severity'] },
  { type: 'poisson_regression', label: 'Poisson / Neg-Binomial Regression', tags: ['count data', 'rate', 'incidence', 'overdispersion'] },
  { type: 'kaplan_meier', label: 'Kaplan-Meier Survival', tags: ['survival', 'time-to-event', 'mortality', 'failure'] },
  { type: 'cox_regression', label: 'Cox Regression', tags: ['hazard ratio', 'survival', 'time-to-event', 'covariates'] },
  { type: 'time_series', label: 'Time Series', tags: ['longitudinal', 'trend', 'seasonal', 'temporal'] },
  { type: 'pca', label: 'PCA', tags: ['dimension reduction', 'latent', 'many variables', 'multicollinearity'] },
  { type: 'factor_analysis', label: 'Factor Analysis', tags: ['scale', 'construct', 'latent', 'psychometric'] },
  { type: 'cluster_analysis', label: 'Cluster Analysis', tags: ['grouping', 'segmentation', 'unsupervised', 'phenotype'] },
  { type: 'meta_analysis', label: 'Meta-Analysis', tags: ['systematic review', 'pooled effect', 'forest plot', 'heterogeneity'] },
  { type: 'spatial_analysis', label: 'Spatial Analysis', tags: ['geographic', 'mapping', 'location', 'cluster'] },
  { type: 'outbreak_investigation', label: 'Outbreak Investigation', tags: ['epidemic', 'attack rate', 'epi curve', 'public health'] },
  { type: 'sample_size', label: 'Sample Size Calculator', tags: ['power', 'planning', 'precision'] },
]

// Static system prompt — defined at module scope so the text is identical
// on every request, which is the prerequisite for a prompt cache hit.
const SYSTEM_PROMPT = `You are an expert biostatistician and research methodologist advising researchers on their statistical analysis.

Based on the research context provided by the user, recommend the most appropriate statistical analyses from the available catalogue.

AVAILABLE ANALYSES:
${ANALYSIS_CATALOGUE.map(a => `- ${a.type}: ${a.label} [tags: ${a.tags.join(', ')}]`).join('\n')}

Return a JSON array of recommendations (3–6 items), ordered by priority. Each item must match this exact schema:
{
  "type": "<analysis_type exactly as listed>",
  "label": "<analysis label>",
  "reason": "<one sentence: why this specific analysis fits this research>",
  "confidence": "high" | "medium" | "low",
  "priority": <integer 1=highest>
}

Rules:
- Only include analyses that genuinely fit the research context
- If dataset columns are provided, use column types to justify suggestions (e.g. binary columns → logistic regression, time columns → survival analysis)
- Confidence is "high" when the research context strongly implies this method, "low" when it is speculative
- Return ONLY the JSON array, no other text`

export async function POST(req: NextRequest) {
  if (!AI_ENABLED) return NextResponse.json({ error: 'AI features are not available on your plan.' }, { status: 503 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateLimitResponse = await checkRateLimit(req, { limit: 20, windowMs: 60 * 60 * 1000 })
  if (rateLimitResponse) return rateLimitResponse

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI suggestions require ANTHROPIC_API_KEY to be configured.' }, { status: 503 })
  }

  let body: SuggestRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { projectTitle, projectDescription, methodology, researchObjectives, columns } = body

  if (
    (projectTitle?.length ?? 0) > MAX_FIELD_LENGTH ||
    (projectDescription?.length ?? 0) > MAX_FIELD_LENGTH ||
    (methodology?.length ?? 0) > MAX_FIELD_LENGTH ||
    (researchObjectives?.length ?? 0) > MAX_FIELD_LENGTH
  ) {
    return NextResponse.json({ error: 'Input field exceeds maximum length of 5000 characters.' }, { status: 400 })
  }

  const columnsSummary = columns && columns.length > 0
    ? columns.slice(0, 40).map(c =>
        `  - "${c.name}" (${c.type}${c.unique_values !== undefined ? `, ${c.unique_values} unique values` : ''}${c.missing ? `, ${c.missing} missing` : ''})`
      ).join('\n')
    : null

  const contextParts: string[] = [`Project: "${projectTitle}"`]
  if (projectDescription) contextParts.push(`Description: ${projectDescription}`)
  if (methodology) contextParts.push(`Methodology: ${methodology}`)
  if (researchObjectives) contextParts.push(`Research objectives: ${researchObjectives}`)
  if (columnsSummary) contextParts.push(`Dataset columns (${columns!.length} total):\n${columnsSummary}`)

  try {
    const message = await client.messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: `RESEARCH CONTEXT:\n${contextParts.join('\n')}` }],
      },
      { headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' } },
    )

    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array in response')

    const suggestions: AnalysisSuggestion[] = JSON.parse(jsonMatch[0])
    // Filter to only valid analysis types
    const validTypes = new Set(ANALYSIS_CATALOGUE.map(a => a.type))
    const filtered = suggestions.filter(s => validTypes.has(s.type as string))

    // Cache identical suggestions for 1 hour in the browser, 24 h on the CDN edge
    return NextResponse.json({ suggestions: filtered }, {
      headers: { 'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400' },
    })
  } catch (err) {
    console.error('[analysis/suggest] Claude error:', err)
    return NextResponse.json({ error: 'Failed to generate suggestions', suggestions: [] }, { status: 500 })
  }
}

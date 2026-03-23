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

interface MintPayload {
  publicationId: string
  title: string
  authors: Array<{ name: string; orcid?: string; affiliation?: string }>
  description: string
  license: string
  keywords: string[]
  geographic_scope?: string
  embargo_until?: string
  year: number
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

    const payload: MintPayload = await req.json()

    const DATACITE_URL = Deno.env.get('DATACITE_API_URL') ?? 'https://api.test.datacite.org'
    const DATACITE_USERNAME = Deno.env.get('DATACITE_USERNAME')
    const DATACITE_PASSWORD = Deno.env.get('DATACITE_PASSWORD')
    const DATACITE_PREFIX = Deno.env.get('DATACITE_PREFIX') ?? '10.5281'

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // If DataCite is not configured, reserve a DOI locally
    if (!DATACITE_USERNAME || !DATACITE_PASSWORD) {
      const seq = String(Math.floor(Math.random() * 99999)).padStart(5, '0')
      const reservedDoi = `${DATACITE_PREFIX}/plexus.${payload.year}${seq}`

      await serviceSupabase
        .from('dataset_publications')
        .update({
          reserved_doi: reservedDoi,
          status: 'reserved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.publicationId)

      return new Response(JSON.stringify({ reserved_doi: reservedDoi, status: 'reserved' }), {
        status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      })
    }

    // DataCite metadata JSON
    const doiSuffix = `plexus.${payload.year}${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`
    const doi = `${DATACITE_PREFIX}/${doiSuffix}`

    const datacitePayload = {
      data: {
        type: 'dois',
        attributes: {
          doi,
          prefix: DATACITE_PREFIX,
          titles: [{ title: payload.title }],
          creators: payload.authors.map(a => ({
            name: a.name,
            ...(a.orcid ? { nameIdentifiers: [{ nameIdentifier: `https://orcid.org/${a.orcid}`, nameIdentifierScheme: 'ORCID' }] } : {}),
            ...(a.affiliation ? { affiliations: [{ name: a.affiliation }] } : {}),
          })),
          descriptions: payload.description
            ? [{ description: payload.description, descriptionType: 'Abstract' }]
            : [],
          subjects: payload.keywords.map(k => ({ subject: k })),
          rightsList: [{ rights: payload.license }],
          geoLocations: payload.geographic_scope
            ? [{ geoLocationPlace: payload.geographic_scope }]
            : [],
          publicationYear: payload.year,
          types: { resourceTypeGeneral: 'Dataset' },
          publisher: 'PLEXUS Research Platform',
          event: payload.embargo_until ? undefined : 'publish',
          ...(payload.embargo_until ? { embargo: { embargoDate: payload.embargo_until } } : {}),
        }
      }
    }

    const credentials = btoa(`${DATACITE_USERNAME}:${DATACITE_PASSWORD}`)
    const dataciteRes = await fetch(`${DATACITE_URL}/dois`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify(datacitePayload),
    })

    if (!dataciteRes.ok) {
      const errorText = await dataciteRes.text()
      console.error('DataCite error:', errorText)
      // Fall back to reserved DOI
      const reservedDoi = `${DATACITE_PREFIX}/plexus.${payload.year}${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`
      await serviceSupabase.from('dataset_publications').update({ reserved_doi: reservedDoi, status: 'reserved', updated_at: new Date().toISOString() }).eq('id', payload.publicationId)
      return new Response(JSON.stringify({ reserved_doi: reservedDoi, status: 'reserved', warning: 'DataCite registration failed; DOI reserved locally' }), {
        status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      })
    }

    await serviceSupabase
      .from('dataset_publications')
      .update({
        doi,
        datacite_metadata: datacitePayload,
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.publicationId)

    return new Response(JSON.stringify({ doi, status: 'published' }), {
      status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    })
  }
})

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DHIS2Config {
  server_url: string
  auth_method: 'basic' | 'pat'
  username?: string
  password_encrypted?: string
  pat_encrypted?: string
  system_name: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { action, connection_id, dataset_id, dry_run } = body

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (action === 'push') {
      return await performPush(supabase, connection_id, dataset_id, dry_run ?? false)
    }

    if (action === 'fetch_resources') {
      return await fetchResources(supabase, connection_id)
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function buildAuthHeader(cfg: DHIS2Config): string {
  if (cfg.auth_method === 'pat') {
    return `ApiToken ${cfg.pat_encrypted}`
  }
  return `Basic ${btoa(`${cfg.username}:${cfg.password_encrypted}`)}`
}

async function fetchResources(supabase: ReturnType<typeof createClient>, connectionId: string) {
  const { data: conn } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (!conn) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const cfg = conn.config as DHIS2Config
  const authHeader = buildAuthHeader(cfg)

  const [deRes, ouRes, catRes] = await Promise.all([
    fetch(`${cfg.server_url}/api/dataElements.json?paging=false&fields=id,displayName,valueType,categoryCombo`, {
      headers: { Authorization: authHeader },
    }),
    fetch(`${cfg.server_url}/api/organisationUnits.json?paging=false&fields=id,displayName,level&level=3`, {
      headers: { Authorization: authHeader },
    }),
    fetch(`${cfg.server_url}/api/categoryCombos.json?paging=false&fields=id,displayName`, {
      headers: { Authorization: authHeader },
    }),
  ])

  const result: Record<string, unknown> = {}
  if (deRes.ok) { const d = await deRes.json(); result.dataElements = d.dataElements ?? [] }
  if (ouRes.ok) { const d = await ouRes.json(); result.orgUnits = d.organisationUnits ?? [] }
  if (catRes.ok) { const d = await catRes.json(); result.categoryCombos = d.categoryCombos ?? [] }

  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function performPush(
  supabase: ReturnType<typeof createClient>,
  connectionId: string,
  datasetId: string,
  dryRun: boolean,
) {
  const { data: conn } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (!conn) return new Response(JSON.stringify({ error: 'Connection not found' }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  const cfg = conn.config as DHIS2Config
  const authHeader = buildAuthHeader(cfg)

  // Fetch field mappings
  const { data: mappings } = await supabase
    .from('integration_field_mappings')
    .select('*')
    .eq('connection_id', connectionId)

  if (!mappings || mappings.length === 0) {
    return new Response(JSON.stringify({ error: 'No field mappings configured' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Fetch dataset rows
  const { data: versions } = await supabase
    .from('dataset_versions')
    .select('id')
    .eq('dataset_id', datasetId)
    .order('created_at', { ascending: false })
    .limit(1)

  const versionId = versions?.[0]?.id
  if (!versionId) return new Response(JSON.stringify({ error: 'No dataset version' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  const { data: rows } = await supabase
    .from('dataset_rows')
    .select('data')
    .eq('version_id', versionId)
    .limit(10000)

  if (!rows) return new Response(JSON.stringify({ error: 'Could not fetch rows' }), {
    status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  const orgUnitMapping = mappings.find(m => m.remote_field === '__org_unit__')
  const periodMapping = mappings.find(m => m.remote_field === '__period__')
  const deMappings = mappings.filter(m => !['__org_unit__', '__period__'].includes(m.remote_field))

  // Aggregate and build data values payload
  const dataValues: { dataElement: string; period: string; orgUnit: string; value: string }[] = []

  for (const deMapping of deMappings) {
    const transform = deMapping.transform as Record<string, string>
    const aggregation = transform?.aggregation ?? 'sum'
    const deId = transform?.data_element_id ?? deMapping.remote_field

    const groups: Record<string, number[]> = {}

    for (const row of rows) {
      const data = row.data as Record<string, unknown>
      const rawValue = data[deMapping.local_column]
      const num = rawValue !== null && rawValue !== undefined && rawValue !== '' ? Number(rawValue) : null
      if (num === null || isNaN(num)) continue

      const orgUnit = orgUnitMapping ? String(data[orgUnitMapping.local_column] ?? 'UNKNOWN') : 'UNKNOWN'
      const period = periodMapping ? String(data[periodMapping.local_column] ?? 'UNKNOWN') : 'UNKNOWN'
      const key = `${orgUnit}||${period}`
      if (!groups[key]) groups[key] = []
      groups[key].push(num)
    }

    for (const [key, values] of Object.entries(groups)) {
      const [orgUnit, period] = key.split('||')
      let aggValue: number
      switch (aggregation) {
        case 'count': aggValue = values.length; break
        case 'average': aggValue = values.reduce((a, b) => a + b, 0) / values.length; break
        case 'min': aggValue = Math.min(...values); break
        case 'max': aggValue = Math.max(...values); break
        default: aggValue = values.reduce((a, b) => a + b, 0)
      }
      dataValues.push({ dataElement: deId, period, orgUnit, value: String(Math.round(aggValue * 100) / 100) })
    }
  }

  // Push to DHIS2
  const endpoint = dryRun
    ? `${cfg.server_url}/api/dataValueSets?dryRun=true`
    : `${cfg.server_url}/api/dataValueSets`

  const dhis2Res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({ dataValues }),
  })

  const dhis2Result = await dhis2Res.json()
  const status = dhis2Res.ok ? (dryRun ? 'dry_run' : 'success') : 'failed'

  // Log push result
  await supabase.from('dhis2_push_logs').insert({
    connection_id: connectionId,
    push_type: 'data_values',
    data_values_count: dataValues.length,
    status,
    import_summary: dhis2Result,
    validation_issues: dhis2Result.conflicts ?? [],
    completed_at: new Date().toISOString(),
  })

  return new Response(JSON.stringify({
    status,
    dry_run: dryRun,
    data_values_count: dataValues.length,
    import_summary: dhis2Result,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

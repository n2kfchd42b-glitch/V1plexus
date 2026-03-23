import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SurveyCTOConfig {
  server_name: string
  username: string
  password_encrypted: string
  form_id: string
  dataset_name: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, connection_id } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (action === 'sync') {
      return await performSync(supabase, connection_id)
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

async function performSync(supabase: ReturnType<typeof createClient>, connectionId: string) {
  // Fetch connection
  const { data: conn, error: connErr } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (connErr || !conn) {
    return new Response(JSON.stringify({ error: 'Connection not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const cfg = conn.config as SurveyCTOConfig
  const startedAt = new Date().toISOString()

  // SurveyCTO API: export submissions in wide (JSON) format
  const base = `https://${cfg.server_name}.surveycto.com`
  const authHeader = 'Basic ' + btoa(`${cfg.username}:${cfg.password_encrypted}`)

  let submissions: Record<string, unknown>[] = []
  try {
    const res = await fetch(
      `${base}/api/v2/forms/data/wide/json/${cfg.form_id}`,
      { headers: { Authorization: authHeader } }
    )
    if (!res.ok) throw new Error(`SurveyCTO API responded with ${res.status}`)
    submissions = await res.json()
  } catch (err) {
    await supabase.from('integration_connections').update({
      status: 'error',
      error_log: err instanceof Error ? err.message : 'Sync failed',
      updated_at: new Date().toISOString(),
    }).eq('id', connectionId)

    return new Response(JSON.stringify({ error: 'Sync failed', detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Find or create dataset
  const projectId = conn.project_id
  const datasetName = cfg.dataset_name ?? 'SurveyCTO Sync'

  let datasetId: string
  const { data: existingDs } = await supabase
    .from('datasets')
    .select('id')
    .eq('project_id', projectId)
    .eq('name', datasetName)
    .maybeSingle()

  if (existingDs) {
    datasetId = existingDs.id
  } else {
    const { data: newDs, error: dsErr } = await supabase
      .from('datasets')
      .insert({
        project_id: projectId,
        name: datasetName,
        source: 'redcap', // reuse existing source type for external sync
        row_count: 0,
        column_count: 0,
      })
      .select('id')
      .single()
    if (dsErr || !newDs) throw new Error('Could not create dataset')
    datasetId = newDs.id
  }

  // Create a new dataset version
  const { data: version, error: vErr } = await supabase
    .from('dataset_versions')
    .insert({
      dataset_id: datasetId,
      version_number: 1,
      commit_message: `SurveyCTO sync — ${submissions.length} submissions`,
      row_count: submissions.length,
      column_count: Object.keys(submissions[0] ?? {}).length,
      source: 'redcap',
      created_by: conn.created_by,
    })
    .select('id')
    .single()

  if (vErr || !version) throw new Error('Could not create dataset version')

  // Insert rows
  if (submissions.length > 0) {
    const rows = submissions.map(sub => ({
      version_id: version.id,
      dataset_id: datasetId,
      data: sub,
    }))
    // Insert in batches of 500
    for (let i = 0; i < rows.length; i += 500) {
      await supabase.from('dataset_rows').insert(rows.slice(i, i + 500))
    }
  }

  // Update dataset row count
  await supabase.from('datasets').update({ row_count: submissions.length }).eq('id', datasetId)

  // Log sync
  const completedAt = new Date().toISOString()
  await supabase.from('sync_log').insert({
    connection_id: connectionId,
    sync_type: 'full',
    records_fetched: submissions.length,
    records_new: submissions.length,
    records_updated: 0,
    records_skipped: 0,
    quality_issues: 0,
    dataset_version_id: version.id,
    status: 'completed',
    started_at: startedAt,
    completed_at: completedAt,
  })

  // Update connection
  await supabase.from('integration_connections').update({
    last_sync_at: completedAt,
    last_sync_status: 'success',
    total_synced: submissions.length,
    error_log: null,
    updated_at: completedAt,
  }).eq('id', connectionId)

  return new Response(JSON.stringify({
    synced: submissions.length,
    dataset_id: datasetId,
    version_id: version.id,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

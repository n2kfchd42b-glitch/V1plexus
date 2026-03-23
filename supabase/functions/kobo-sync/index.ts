import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface KoboAsset {
  uid: string
  name: string
  deployment__active: boolean
  deployment__submission_count: number
}

interface KoboSubmission {
  _id: number
  _submission_time: string
  [key: string]: unknown
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { action } = body

    // ─── CONNECT: Validate token and list projects ────────────────────────────
    if (action === 'connect') {
      const { api_token, kobo_server_url } = body
      const baseUrl = kobo_server_url?.replace(/\/$/, '') ?? 'https://kf.kobotoolbox.org'

      const res = await fetch(`${baseUrl}/api/v2/assets/?format=json&limit=200`, {
        headers: { Authorization: `Token ${api_token}` },
      })

      if (!res.ok) {
        return new Response(JSON.stringify({ error: 'Invalid token or server unreachable' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const data = await res.json()
      const projects = (data.results ?? [])
        .filter((a: KoboAsset) => a.deployment__active)
        .map((a: KoboAsset) => ({
          uid: a.uid,
          name: a.name,
          deployment_status: a.deployment__active ? 'deployed' : 'archived',
          submission_count: a.deployment__submission_count ?? 0,
        }))

      return new Response(JSON.stringify({ projects }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── SETUP: Configure mapping and register webhook ────────────────────────
    if (action === 'setup') {
      const { connection_id, kobo_asset_uid } = body

      const { data: connection } = await supabase
        .from('integration_connections')
        .select('*')
        .eq('id', connection_id)
        .single()

      if (!connection) {
        return new Response(JSON.stringify({ error: 'Connection not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const config = connection.config as Record<string, string>
      const baseUrl = config.server_url?.replace(/\/$/, '') ?? 'https://kf.kobotoolbox.org'
      const token = config.api_token

      // Fetch form schema
      const formRes = await fetch(`${baseUrl}/api/v2/assets/${kobo_asset_uid}/?format=json`, {
        headers: { Authorization: `Token ${token}` },
      })
      const formData = await formRes.json()

      // Register webhook pointing back to this function for realtime sync
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/kobo-sync`
      try {
        await fetch(`${baseUrl}/api/v2/assets/${kobo_asset_uid}/hooks/`, {
          method: 'POST',
          headers: {
            Authorization: `Token ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'plexus_sync',
            endpoint: webhookUrl,
            active: true,
            export_type: 'json',
          }),
        })
      } catch (_) {
        // Webhook registration failure is non-fatal; polling will still work
      }

      // Store field mapping
      const fields = (formData.content?.survey ?? [])
        .filter((f: { type: string; name?: string; $autoname?: string }) => f.type !== 'note' && f.name)
        .map((f: { type: string; name?: string; $autoname?: string; label?: string[] }) => ({
          kobo_name: f.name ?? f.$autoname,
          plexus_name: f.name ?? f.$autoname,
          type: mapKoboType(f.type),
        }))

      await supabase.from('integration_connections').update({
        config: { ...config, field_mapping: fields, kobo_asset_uid },
        updated_at: new Date().toISOString(),
      }).eq('id', connection_id)

      // Trigger initial sync
      return await performSync(supabase, connection_id, 'full', config, baseUrl, token, kobo_asset_uid)
    }

    // ─── SYNC: Pull new data ──────────────────────────────────────────────────
    if (action === 'sync') {
      const { connection_id } = body

      const { data: connection } = await supabase
        .from('integration_connections')
        .select('*')
        .eq('id', connection_id)
        .single()

      if (!connection) {
        return new Response(JSON.stringify({ error: 'Connection not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const config = connection.config as Record<string, string>
      const baseUrl = config.server_url?.replace(/\/$/, '') ?? 'https://kf.kobotoolbox.org'
      const token = config.api_token
      const assetUid = config.kobo_asset_uid

      return await performSync(supabase, connection_id, 'manual', config, baseUrl, token, assetUid)
    }

    // ─── DISCONNECT: Remove webhook ───────────────────────────────────────────
    if (action === 'disconnect') {
      const { connection_id } = body
      await supabase.from('integration_connections').update({
        status: 'disconnected',
        updated_at: new Date().toISOString(),
      }).eq('id', connection_id)

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── WEBHOOK: Receive Kobo webhook payload ────────────────────────────────
    // KoboToolbox sends POST with submission data directly
    if (!action && req.method === 'POST') {
      const payload = body as KoboSubmission & { _asset_uid?: string }
      const assetUid = payload._asset_uid

      if (assetUid) {
        // Find the connection for this asset
        const { data: connections } = await supabase
          .from('integration_connections')
          .select('*')
          .eq('status', 'active')
          .filter('config->>kobo_asset_uid', 'eq', assetUid)
          .limit(1)

        if (connections?.length) {
          const conn = connections[0]
          const config = conn.config as Record<string, string>
          await appendKoboSubmission(supabase, conn.id, config, [payload])
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('kobo-sync error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapKoboType(koboType: string): string {
  if (['integer', 'decimal'].includes(koboType)) return 'numeric'
  if (koboType === 'date' || koboType === 'datetime') return 'date'
  if (['select_one', 'select_multiple'].includes(koboType)) return 'categorical'
  if (koboType === 'geopoint') return 'text'
  return 'text'
}

async function performSync(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  connectionId: string,
  syncType: string,
  config: Record<string, string>,
  baseUrl: string,
  token: string,
  assetUid: string,
) {
  const startedAt = new Date()
  let recordsFetched = 0
  let recordsNew = 0

  try {
    const { data: connection } = await supabase
      .from('integration_connections')
      .select('last_sync_at, project_id, total_synced')
      .eq('id', connectionId)
      .single()

    // Build query for incremental sync
    let query = `${baseUrl}/api/v2/assets/${assetUid}/data/?format=json&limit=5000`
    if (connection?.last_sync_at && syncType !== 'full') {
      const since = encodeURIComponent(JSON.stringify({ _submission_time: { $gt: connection.last_sync_at } }))
      query += `&query=${since}`
    }

    const res = await fetch(query, { headers: { Authorization: `Token ${token}` } })
    if (!res.ok) throw new Error(`Kobo API error: ${res.status}`)

    const data = await res.json()
    const submissions: KoboSubmission[] = data.results ?? []
    recordsFetched = submissions.length

    if (submissions.length > 0) {
      recordsNew = await appendKoboSubmission(supabase, connectionId, config, submissions)
    }

    // Update connection status
    await supabase.from('integration_connections').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'success',
      total_synced: (connection?.total_synced ?? 0) + recordsNew,
      updated_at: new Date().toISOString(),
    }).eq('id', connectionId)

    // Log the sync
    const completedAt = new Date()
    await supabase.from('sync_log').insert({
      connection_id: connectionId,
      sync_type: syncType,
      records_fetched: recordsFetched,
      records_new: recordsNew,
      records_updated: 0,
      records_skipped: recordsFetched - recordsNew,
      quality_issues: 0,
      status: 'completed',
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      duration_ms: completedAt.getTime() - startedAt.getTime(),
    })

    return new Response(JSON.stringify({ success: true, records_new: recordsNew, records_fetched: recordsFetched }), {
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // Log the failed sync
    await supabase.from('integration_connections').update({
      status: 'error',
      error_log: String(err),
      updated_at: new Date().toISOString(),
    }).eq('id', connectionId)

    await supabase.from('sync_log').insert({
      connection_id: connectionId,
      sync_type: syncType,
      records_fetched: recordsFetched,
      status: 'failed',
      error_message: String(err),
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
    })

    throw err
  }
}

async function appendKoboSubmission(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  connectionId: string,
  config: Record<string, string>,
  submissions: KoboSubmission[],
): Promise<number> {
  const { data: connection } = await supabase
    .from('integration_connections')
    .select('project_id')
    .eq('id', connectionId)
    .single()

  const projectId = connection?.project_id
  const datasetName = config.dataset_name ?? 'KoboSync Dataset'
  const mapping: Array<{ kobo_name: string; plexus_name: string; type: string }> = config.field_mapping
    ? JSON.parse(config.field_mapping as unknown as string)
    : []

  // Find or create dataset
  let { data: dataset } = await supabase
    .from('datasets')
    .select('id')
    .eq('project_id', projectId)
    .eq('name', datasetName)
    .is('deleted_at', null)
    .single()

  if (!dataset) {
    const cols = mapping.length > 0
      ? mapping.map(m => ({ name: m.plexus_name, type: m.type, original_name: m.kobo_name }))
      : Object.keys(submissions[0] ?? {}).filter(k => !k.startsWith('_')).map(k => ({ name: k, type: 'text', original_name: k }))

    const { data: newDataset } = await supabase.from('datasets').insert({
      project_id: projectId,
      name: datasetName,
      source: 'kobo',
      row_count: 0,
      column_count: cols.length,
      schema_info: { columns: cols },
    }).select().single()

    dataset = newDataset
  }

  if (!dataset) return 0

  // Transform submissions to rows
  const rows = submissions.map(sub => {
    const row: Record<string, unknown> = {}
    if (mapping.length > 0) {
      for (const m of mapping) {
        row[m.plexus_name] = sub[m.kobo_name]
      }
    } else {
      for (const [k, v] of Object.entries(sub)) {
        if (!k.startsWith('_')) row[k] = v
      }
    }
    row._kobo_id = sub._id
    row._submitted_at = sub._submission_time
    return row
  })

  // Create new dataset version with the appended data
  const { data: prevVersion } = await supabase
    .from('dataset_versions')
    .select('version_number, row_count')
    .eq('dataset_id', dataset.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  const versionNumber = (prevVersion?.version_number ?? 0) + 1
  const prevRowCount = prevVersion?.row_count ?? 0

  const { data: version } = await supabase.from('dataset_versions').insert({
    dataset_id: dataset.id,
    version_number: versionNumber,
    commit_message: `KoboToolbox sync: +${rows.length} new submissions`,
    row_count: prevRowCount + rows.length,
    column_count: Object.keys(rows[0] ?? {}).length,
    storage_path: null,
  }).select().single()

  // Update dataset metadata
  await supabase.from('datasets').update({
    row_count: prevRowCount + rows.length,
    updated_at: new Date().toISOString(),
  }).eq('id', dataset.id)

  return rows.length
}

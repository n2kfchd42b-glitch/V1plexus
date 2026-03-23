import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ZoteroConfig {
  api_key_encrypted: string
  user_id: number
  library_id: number
  library_type: 'user' | 'group'
  library_name: string
}

interface ZoteroItem {
  key: string
  version: number
  data: {
    title?: string
    itemType?: string
    abstractNote?: string
    DOI?: string
    ISSN?: string
    ISBN?: string
    url?: string
    date?: string
    creators?: Array<{ creatorType: string; firstName?: string; lastName?: string; name?: string }>
    tags?: Array<{ tag: string }>
    publicationTitle?: string
    volume?: string
    issue?: string
    pages?: string
    publisher?: string
    place?: string
    language?: string
    extra?: string
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, connection_id, project_id } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (action === 'sync') {
      return await performSync(supabase, connection_id, project_id)
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

async function performSync(
  supabase: ReturnType<typeof createClient>,
  connectionId: string,
  projectId: string,
) {
  const { data: conn } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (!conn) return new Response(JSON.stringify({ error: 'Connection not found' }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  const cfg = conn.config as ZoteroConfig
  const apiKey = cfg.api_key_encrypted
  const libraryPrefix = cfg.library_type === 'user'
    ? `users/${cfg.library_id}`
    : `groups/${cfg.library_id}`

  // Get current library version from our sync state
  const { data: syncState } = await supabase
    .from('zotero_sync_state')
    .select('library_version')
    .eq('connection_id', connectionId)
    .maybeSingle()

  const sinceVersion = syncState?.library_version ?? 0

  // Fetch items since last sync version
  const itemsRes = await fetch(
    `https://api.zotero.org/${libraryPrefix}/items?since=${sinceVersion}&format=json&limit=100`,
    { headers: { 'Zotero-API-Key': apiKey, 'Zotero-API-Version': '3' } }
  )

  if (!itemsRes.ok) {
    await supabase.from('integration_connections').update({
      status: 'error',
      error_log: `Zotero API responded with ${itemsRes.status}`,
      updated_at: new Date().toISOString(),
    }).eq('id', connectionId)
    return new Response(JSON.stringify({ error: `Zotero API error: ${itemsRes.status}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const newLibraryVersion = Number(itemsRes.headers.get('Last-Modified-Version') ?? sinceVersion)
  const items: ZoteroItem[] = await itemsRes.json()

  let synced = 0
  let skipped = 0

  // Map Zotero items to project_citations (CSL-JSON compatible)
  for (const item of items) {
    if (!item.data.title) { skipped++; continue }

    const cslData = mapZoteroToCSL(item)

    // Check if citation already exists (by DOI or Zotero key in extra field)
    const { data: existing } = await supabase
      .from('project_citations')
      .select('id')
      .eq('project_id', projectId)
      .filter('citation_data->zotero_key', 'eq', item.key)
      .maybeSingle()

    if (existing) {
      // Update existing citation
      await supabase.from('project_citations').update({
        citation_data: { ...cslData, zotero_key: item.key, zotero_version: item.version },
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      // Insert new citation
      const { error } = await supabase.from('project_citations').insert({
        project_id: projectId,
        citation_data: { ...cslData, zotero_key: item.key, zotero_version: item.version },
        source: 'zotero',
      })
      if (!error) synced++
    }
  }

  // Update sync state
  await supabase.from('zotero_sync_state').upsert({
    connection_id: connectionId,
    library_version: newLibraryVersion,
    last_synced_at: new Date().toISOString(),
    item_count: (syncState?.library_version ?? 0) === 0 ? items.length : undefined,
  }, { onConflict: 'connection_id' })

  // Update connection status
  await supabase.from('integration_connections').update({
    last_sync_at: new Date().toISOString(),
    last_sync_status: 'success',
    total_synced: (conn.total_synced ?? 0) + synced,
    error_log: null,
    updated_at: new Date().toISOString(),
  }).eq('id', connectionId)

  // Log sync
  await supabase.from('sync_log').insert({
    connection_id: connectionId,
    sync_type: sinceVersion === 0 ? 'full' : 'incremental',
    records_fetched: items.length,
    records_new: synced,
    records_updated: items.length - synced - skipped,
    records_skipped: skipped,
    quality_issues: 0,
    status: 'completed',
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  })

  return new Response(JSON.stringify({
    synced,
    skipped,
    total_items: items.length,
    library_version: newLibraryVersion,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function mapZoteroToCSL(item: ZoteroItem): Record<string, unknown> {
  const d = item.data

  // Map Zotero item type to CSL type
  const typeMap: Record<string, string> = {
    journalArticle: 'article-journal',
    book: 'book',
    bookSection: 'chapter',
    conferencePaper: 'paper-conference',
    thesis: 'thesis',
    report: 'report',
    webpage: 'webpage',
    preprint: 'article',
    document: 'document',
    presentation: 'speech',
    film: 'motion_picture',
    podcast: 'broadcast',
    manuscript: 'manuscript',
  }

  const authors = (d.creators ?? [])
    .filter(c => c.creatorType === 'author')
    .map(c => ({
      given: c.firstName ?? '',
      family: c.lastName ?? c.name ?? '',
    }))

  return {
    type: typeMap[d.itemType ?? ''] ?? 'document',
    title: d.title ?? '',
    author: authors,
    abstract: d.abstractNote ?? undefined,
    DOI: d.DOI ?? undefined,
    ISSN: d.ISSN ?? undefined,
    ISBN: d.ISBN ?? undefined,
    URL: d.url ?? undefined,
    issued: d.date ? { 'date-parts': [[Number(d.date.slice(0, 4))]] } : undefined,
    'container-title': d.publicationTitle ?? undefined,
    volume: d.volume ?? undefined,
    issue: d.issue ?? undefined,
    page: d.pages ?? undefined,
    publisher: d.publisher ?? undefined,
    'publisher-place': d.place ?? undefined,
    language: d.language ?? undefined,
    keyword: (d.tags ?? []).map(t => t.tag).join(', ') || undefined,
  }
}

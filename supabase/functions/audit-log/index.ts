import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const {
      action,
      resource_type,
      resource_id,
      actor_id,
      details = {},
      project_id,
      institution_id,
    } = await req.json()

    if (!action || !resource_type || !resource_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch the most recent entry hash for chain linking
    const { data: lastEntry } = await serviceSupabase
      .from('audit_logs')
      .select('entry_hash')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    const prevHash = lastEntry?.entry_hash ?? null

    const timestamp = new Date().toISOString()
    const entryContent = JSON.stringify({
      timestamp,
      actor_id,
      action,
      resource_type,
      resource_id,
      project_id: project_id ?? null,
      institution_id: institution_id ?? null,
      details,
      prev_hash: prevHash,
    })

    const entryHash = await sha256(entryContent)

    const { error } = await serviceSupabase.from('audit_logs').insert({
      timestamp,
      actor_id: actor_id ?? null,
      action,
      resource_type,
      resource_id,
      project_id: project_id ?? null,
      institution_id: institution_id ?? null,
      details,
      prev_hash: prevHash,
      entry_hash: entryHash,
    })

    if (error) {
      console.error('audit-log insert error:', error)
      return new Response(JSON.stringify({ error: 'Failed to insert audit log' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ ok: true, entry_hash: entryHash }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('audit-log error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

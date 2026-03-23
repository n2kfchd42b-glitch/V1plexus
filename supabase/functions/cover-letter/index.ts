import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async () => {
  return new Response(JSON.stringify({ error: 'Not yet deployed' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })
})

// Re-export the browser Supabase client for use in client components and hooks.
// Server/service clients import directly from @/lib/supabase/server or @/lib/supabase/service —
// never re-exported here because next/headers must not enter the client bundle.

export { createClient as createBrowserClient } from '@/lib/supabase/client'

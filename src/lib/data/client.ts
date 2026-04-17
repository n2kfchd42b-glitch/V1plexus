// Re-export the existing Supabase clients — do not create duplicates.
// Browser client is the @supabase/ssr singleton used by all components.
// Server client is the cookie-aware SSR client used by API routes.
// Service client bypasses RLS — use only for trusted server operations.

export { createClient as createBrowserClient } from '@/lib/supabase/client'
export { createClient as createServerClient } from '@/lib/supabase/server'
export { createServiceClient } from '@/lib/supabase/service'

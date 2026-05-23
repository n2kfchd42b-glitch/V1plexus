import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env'

// In-process lock: a simple promise chain per lock name.
// This replaces the default navigator.locks implementation, which uses the
// Web Locks API and triggers "lock stolen" errors under React Strict Mode
// (effects run twice, causing two concurrent onAuthStateChange subscriptions
// to race for the same lock). Since we use a singleton client + single
// AuthProvider subscription, in-process serialisation is sufficient.
const _lockQueues = new Map<string, Promise<unknown>>()

function processLock<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  const tail = (_lockQueues.get(name) ?? Promise.resolve()).then(fn, fn) as Promise<R>
  // Store only the tail so completed entries can be GC'd.
  _lockQueues.set(name, tail.then(() => {}, () => {}))
  return tail
}

// Singleton — all components share one client so they never race for the auth token lock.
let _client: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  if (!_client) {
    _client = createBrowserClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          lock: processLock,
        },
      }
    )
  }
  return _client
}

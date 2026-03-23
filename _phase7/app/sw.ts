import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist, NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'serwist'

// This declares the value of `injectionPoint` to TypeScript.
declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: /^https:\/\/.*\.supabase\.co\/rest\//,
      handler: new NetworkFirst({
        cacheName: 'supabase-api',
        networkTimeoutSeconds: 5,
        plugins: [{ cacheWillUpdate: async ({ response }) => (response?.status === 200 ? response : null) }],
      }),
    },
    {
      matcher: /^https:\/\/.*\.supabase\.co\/storage\//,
      handler: new CacheFirst({
        cacheName: 'supabase-storage',
        plugins: [{ cacheWillUpdate: async ({ response }) => (response?.status === 200 ? response : null) }],
      }),
    },
    {
      matcher: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: new CacheFirst({
        cacheName: 'images',
        plugins: [{ cacheWillUpdate: async ({ response }) => (response?.status === 200 ? response : null) }],
      }),
    },
    {
      matcher: /\.(?:js|css|woff2?)$/,
      handler: new StaleWhileRevalidate({
        cacheName: 'static-resources',
      }),
    },
  ],
  fallbacks: {
    entries: [{ url: '/offline', matcher: ({ request }) => request.destination === 'document' }],
  },
})

serwist.addEventListeners()

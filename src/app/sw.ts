/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate, Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
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
    // Supabase REST API — network-first, fall back to cache after 5s
    {
      matcher: /^https:\/\/.*\.supabase\.co\/rest\//,
      handler: new NetworkFirst({
        cacheName: 'supabase-api',
        networkTimeoutSeconds: 5,
        plugins: [
          {
            cacheWillUpdate: async ({ response }) =>
              response?.status === 200 ? response : null,
          },
        ],
      }),
    },

    // Supabase storage (images, files) — cache-first
    {
      matcher: /^https:\/\/.*\.supabase\.co\/storage\//,
      handler: new CacheFirst({
        cacheName: 'supabase-storage',
        plugins: [
          {
            cacheWillUpdate: async ({ response }) =>
              response?.status === 200 ? response : null,
          },
        ],
      }),
    },

    // Next.js optimised images
    {
      matcher: /\/_next\/image\?.*/,
      handler: new StaleWhileRevalidate({ cacheName: 'plexus-next-image' }),
    },

    // Google Font stylesheets
    {
      matcher: /^https:\/\/fonts\.googleapis\.com\/.*/,
      handler: new StaleWhileRevalidate({ cacheName: 'plexus-google-fonts-css' }),
    },

    // Google Font files
    {
      matcher: /^https:\/\/fonts\.gstatic\.com\/.*/,
      handler: new CacheFirst({ cacheName: 'plexus-google-fonts-files' }),
    },

    // Static JS/CSS/font assets
    {
      matcher: /\.(?:js|css|woff2?)$/,
      handler: new StaleWhileRevalidate({ cacheName: 'plexus-static-resources' }),
    },

    // App page routes — network-first with 5s timeout
    {
      matcher: ({ url }: { url: URL }) => {
        const routes = [
          '/dashboard',
          '/dataset-hub',
          '/analysis',
          '/documents',
          '/audit',
          '/profile',
          '/projects',
          '/output',
        ]
        return routes.some(r => url.pathname.startsWith(r))
      },
      handler: new NetworkFirst({
        cacheName: 'plexus-app-pages',
        networkTimeoutSeconds: 5,
      }),
    },

    // Images
    {
      matcher: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: new CacheFirst({
        cacheName: 'plexus-images',
        plugins: [
          {
            cacheWillUpdate: async ({ response }) =>
              response?.status === 200 ? response : null,
          },
        ],
      }),
    },
  ],

  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
})

serwist.addEventListeners()

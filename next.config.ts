import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // Disable in development — service workers interfere with hot reloading
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  compress: true,

  productionBrowserSourceMaps: false,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dsswjchsnayhngjkbbed.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Pin Turbopack to the correct workspace root (prevents lockfile confusion)
  turbopack: {
    root: __dirname,
  },

  // Tree-shake large libraries so only used exports are bundled
  experimental: {
    optimizePackageImports: [
      'recharts',
      'lucide-react',
      '@radix-ui/react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'framer-motion',
      'date-fns',
    ],
  },

  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        // Cross-origin isolation for the analysis route only, so the WebR code
        // lane gets SharedArrayBuffer (the fast channel) instead of the
        // PostMessage fallback, which stalls. COEP 'credentialless' is used (not
        // 'require-corp') so cross-origin no-cors subresources still load
        // without needing CORP headers; Supabase API uses CORS and WebSockets
        // are exempt, so data/realtime are unaffected. Scoped to this route to
        // avoid imposing isolation on the rest of the app.
        source: '/projects/:id/analysis',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ]
  },
}

export default withSerwist(nextConfig)

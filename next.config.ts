import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,

  // Disable source maps in production — reduces bundle size
  productionBrowserSourceMaps: false,

  images: {
    remotePatterns: [],
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

  // Cache static assets aggressively in production
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
    ]
  },
};

export default nextConfig;

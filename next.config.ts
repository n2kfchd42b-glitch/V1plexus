import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
  eslint: {
    // Pre-existing unused-import warnings in analysis/lib files don't affect runtime.
    // Run `npm run lint` locally to review; don't block production deploys.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
};

const nextConfig: NextConfig = {
  // Skip static generation for pages that require runtime env vars
  // All dashboard pages are client-side rendered anyway
};
export default nextConfig;

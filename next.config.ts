import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NEXT_BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@freelancerhisab/shared"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;


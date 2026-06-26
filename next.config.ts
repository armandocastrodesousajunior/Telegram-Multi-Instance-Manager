import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["telegram"],
  experimental: {}
};

export default nextConfig;

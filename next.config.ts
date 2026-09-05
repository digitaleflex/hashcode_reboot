import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone is only needed for Docker/self-hosted builds.
  // On Vercel, Next 16's adapter injection skips emitting next-server.js.nft.json
  // while the standalone finalizer still reads it — causing ENOENT.
  // See: https://github.com/vercel/next.js/issues/96646
  output: process.env.VERCEL ? undefined : "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;

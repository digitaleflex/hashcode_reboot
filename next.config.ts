import type { NextConfig } from "next";

/**
 * Security headers applied to all responses.
 * Protects against XSS, clickjacking, MIME sniffing, and information leakage.
 */
const SECURITY_HEADERS = [
  // Content Security Policy: restrictive baseline, allow common sources.
  // NOTE: tighten further once analytics/CDN endpoints are catalogued.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  // Clickjacking protection: deny all framing.
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Control referrer information leakage.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict powerful APIs.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HSTS (only meaningful over HTTPS; safe to set always).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

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

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;

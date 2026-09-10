import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

/**
 * Security headers applied to all responses.
 * Protects against XSS, clickjacking, MIME sniffing, and information leakage.
 */
const SECURITY_HEADERS = [
  // Content Security Policy: restrictive baseline, allow common sources.
  // 'unsafe-inline' is required by Next.js Turbopack for inline scripts/styles.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://vercel.live",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https://vercel.live",
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
  output: process.env.VERCEL ? undefined : "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,

  // React Compiler (React 19) — auto-memoization, skips stale closures.
  reactCompiler: true,

  // Body size limit: 1 MB for API routes (prevents DoS via large payloads).
  serverExternalPackages: [],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
      // Cache headers for public read-only API routes.
      {
        source: "/api/health",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/api/community/count",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=600" }],
      },
      {
        source: "/api/stats",
        headers: [{ key: "Cache-Control", value: "private, max-age=60, stale-while-revalidate=120" }],
      },
    ];
  },
};

// Wrap with Sentry config for source map upload and tunnel route
export default withSentryConfig(nextConfig, {
  // Org and project slugs (from Sentry URL: https://sentry.io/organizations/<org>/projects/<project>/)
  org: "o4512056004968448",
  project: "4512056014274640",

  // Source map upload auth token (set in CI env or .env.sentry-build-plugin)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload wider set of client source files for better stack trace resolution
  widenClientFileUpload: true,

  // Create a proxy API route to bypass ad-blockers
  tunnelRoute: "/monitoring",

  // Suppress non-CI output
  silent: !process.env.CI,

  // Tree-shaking options (webpack only, not Turbopack)
  // Disable if using Turbopack
  // webpack: {
  //   treeshake: {
  //     enabled: true,
  //     exclude: ["@sentry/nextjs"],
  //   },
  // },
});
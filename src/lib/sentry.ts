/**
 * Sentry helper functions for HASHCODE REBOOT.
 *
 * Initialization is handled by:
 * - src/instrumentation-client.ts (browser/client)
 * - src/sentry.server.config.ts (Node.js server)
 * - src/sentry.edge.config.ts (Edge runtime)
 * - src/instrumentation.ts (server registration hook)
 *
 * Grand nettoyage : `captureMessage`, `setUserContext`, `addBreadcrumb`,
 * `startSpan`, `withSentry` and `getTraceId` had zero consumers and were
 * removed. `captureException` stays — it is used by src/app/global-error.tsx.
 */

import * as Sentry from "@sentry/nextjs";

/** Check if Sentry is configured. */
function isSentryConfigured(): boolean {
  return !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/** Capture an exception with optional extra context. */
export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!isSentryConfigured()) return;

  Sentry.captureException(error, {
    extra: context,
  });
}
/**
 * Sentry helper functions for HASHCODE REBOOT.
 *
 * Initialization is now handled by:
 * - src/instrumentation-client.ts (browser/client)
 * - src/sentry.server.config.ts (Node.js server)
 * - src/sentry.edge.config.ts (Edge runtime)
 * - src/instrumentation.ts (server registration hook)
 *
 * This file provides utility functions for manual error capture,
 * user context, breadcrumbs, and performance monitoring.
 */

import * as Sentry from "@sentry/nextjs";

/** Check if Sentry is configured. */
function isSentryConfigured(): boolean {
  return !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/** Capture an exception with additional context. */
export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!isSentryConfigured()) return;

  Sentry.captureException(error, {
    extra: context,
  });
}

/** Capture a message with level. */
export function captureMessage(message: string, level: "fatal" | "error" | "warning" | "info" | "debug" = "info", context?: Record<string, unknown>) {
  if (!isSentryConfigured()) return;

  // Use captureException with a synthetic error for messages
  const error = new Error(message);
  error.name = `Message:${level}`;
  Sentry.captureException(error, {
    extra: context,
    level,
  });
}

/** Set user context for error tracking. */
export function setUserContext(user: { id: string; email?: string; role?: string } | null) {
  if (!isSentryConfigured()) return;

  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  } else {
    Sentry.setUser(null);
  }
}

/** Add breadcrumb for debugging. */
export function addBreadcrumb(breadcrumb: Parameters<typeof Sentry.addBreadcrumb>[0]) {
  if (!isSentryConfigured()) return;

  Sentry.addBreadcrumb(breadcrumb);
}

/** Start a span for performance monitoring. */
export function startSpan(name: string, op: string) {
  if (!isSentryConfigured()) {
    return { end: () => {}, setTag: () => {}, setAttribute: () => {} };
  }

  return Sentry.startSpan({ name, op }, (span) => span);
}

/** Wrap a function with error tracking. */
export function withSentry<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  name: string
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureException(error, { function: name, args: args.map(String) });
      throw error;
    }
  }) as T;
}

/** Get current trace ID for correlation. */
export function getTraceId(): string | undefined {
  if (!isSentryConfigured()) return undefined;

  // Use the active span from the current scope
  const scope = Sentry.getCurrentScope();
  const span = (scope as { _span?: { spanContext(): { traceId: string } } })._span;
  return span?.spanContext().traceId;
}
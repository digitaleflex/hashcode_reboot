/**
 * Structured logging with correlation IDs for HASHCODE REBOOT (Server-side only).
 *
 * Features:
 * - Request ID generation/propagation (via headers or auto-generated)
 * - Structured JSON output for log aggregation
 * - Context enrichment (user, session, route, timing)
 * - Level-based filtering (debug, info, warn, error)
 * - No secret leakage (auto-redacts known sensitive fields)
 *
 * NOTE: This module uses `next/headers` and can ONLY be used in Server Components,
 * API Routes, Server Actions, and Middleware. For client-side logging, use
 * `createClientLogger` from '@/lib/logging-client'.
 */

import { headers } from "next/headers";
import { v4 as uuidv4 } from "uuid";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  route?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  durationMs?: number;
  statusCode?: number;
  error?: Error | Record<string, unknown>;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  service: "hashcode-reboot";
  version: string;
  environment: string;
}

/** Sensitive field patterns that should never be logged. */
const SENSITIVE_PATTERNS = [
  /password/i,
  /passcode/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /authorization/i,
  /cookie/i,
  /session/i,
  /otp/i,
  /hash/i,
  /credit[_-]?card/i,
  /cvv/i,
  /ssn/i,
];

/** Redact sensitive values from an object. */
function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_PATTERNS.some((p) => p.test(key));
    if (isSensitive) {
      result[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redactSensitive(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((v) =>
        typeof v === "object" && v !== null ? redactSensitive(v as Record<string, unknown>) : v
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Get or generate request ID from headers. */
export async function getRequestId(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-request-id") ??
    h.get("x-vercel-id") ??
    h.get("cf-ray") ??
    `req_${uuidv4().slice(0, 12)}`
  );
}

/** Extract client IP from headers. */
export async function getClientIp(): Promise<string | undefined> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim();
  return h.get("x-real-ip") ?? undefined;
}

/** Extract user agent from headers. */
export async function getUserAgent(): Promise<string | undefined> {
  const h = await headers();
  return h.get("user-agent") ?? undefined;
}

/** Create a logger with request context (async, server-only). */
export async function createLogger(baseContext: LogContext = {}) {
  const requestId = baseContext.requestId ?? (await getRequestId());
  const ip = baseContext.ip ?? (await getClientIp());
  const userAgent = baseContext.userAgent ?? (await getUserAgent());

  const enrichedContext: LogContext = {
    requestId,
    ip,
    userAgent,
    ...baseContext,
  };

  function log(level: LogLevel, message: string, extraContext: LogContext = {}) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: redactSensitive({ ...enrichedContext, ...extraContext }),
      service: "hashcode-reboot",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
      environment: process.env.NODE_ENV ?? "development",
    };

    // In development, pretty-print to console
    if (process.env.NODE_ENV !== "production") {
      const color =
        level === "error"
          ? "\x1b[31m"
          : level === "warn"
          ? "\x1b[33m"
          : level === "info"
          ? "\x1b[36m"
          : "\x1b[90m";
      const reset = "\x1b[0m";
      console[level === "debug" ? "log" : level](
        `${color}[${level.toUpperCase()}]${reset} ${message}`,
        JSON.stringify(entry.context, null, 2)
      );
    } else {
      // Production: structured JSON to stdout (captured by Vercel/container logs)
      console.log(JSON.stringify(entry));
    }
  }

  return {
    debug: (message: string, context?: LogContext) => log("debug", message, context),
    info: (message: string, context?: LogContext) => log("info", message, context),
    warn: (message: string, context?: LogContext) => log("warn", message, context),
    error: (message: string, context?: LogContext) => log("error", message, context),
    child: (extraContext: LogContext) => createLogger({ ...enrichedContext, ...extraContext }),
    withTiming: async <T>(operation: string, fn: () => Promise<T>): Promise<T> => {
      const start = Date.now();
      try {
        const result = await fn();
        log("info", `${operation} completed`, { durationMs: Date.now() - start });
        return result;
      } catch (err) {
        log("error", `${operation} failed`, { durationMs: Date.now() - start, error: err as Error });
        throw err;
      }
    },
  };
}

/** Middleware helper: attach request ID to response headers. */
export async function withRequestId(response: Response, requestId?: string): Promise<Response> {
  const id = requestId ?? (await getRequestId());
  response.headers.set("x-request-id", id);
  return response;
}

/** Error serialization for logging (preserves stack, removes circular refs). */
export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause ? serializeError(error.cause) : undefined,
    };
  }
  return { message: String(error) };
}
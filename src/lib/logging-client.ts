/**
 * Client-side logging for HASHCODE REBOOT.
 *
 * Lightweight logger for browser environments.
 * Does NOT use next/headers - safe for Client Components.
 */

import { v4 as uuidv4 } from "uuid";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  route?: string;
  method?: string;
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

/** Generate a client-side request ID. */
function generateRequestId(): string {
  return `client_${uuidv4().slice(0, 12)}`;
}

/** Create a client-side logger (sync, safe for Client Components). */
export function createClientLogger(baseContext: LogContext = {}) {
  const requestId = baseContext.requestId ?? generateRequestId();

  const enrichedContext: LogContext = {
    requestId,
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

    // Pretty-print to console
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
  }

  return {
    debug: (message: string, context?: LogContext) => log("debug", message, context),
    info: (message: string, context?: LogContext) => log("info", message, context),
    warn: (message: string, context?: LogContext) => log("warn", message, context),
    error: (message: string, context?: LogContext) => log("error", message, context),
    child: (extraContext: LogContext) => createClientLogger({ ...enrichedContext, ...extraContext }),
    withTiming: <T>(operation: string, fn: () => Promise<T>): Promise<T> => {
      const start = Date.now();
      return fn()
        .then((result) => {
          log("info", `${operation} completed`, { durationMs: Date.now() - start });
          return result;
        })
        .catch((err) => {
          log("error", `${operation} failed`, { durationMs: Date.now() - start, error: err as Error });
          throw err;
        });
    },
  };
}

/** Default client logger instance. */
export const clientLogger = createClientLogger();
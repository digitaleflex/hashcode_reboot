import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Data collection: conservative defaults, opt-in for PII
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Attach local variable values to stack frames (server only)
  includeLocalVariables: true,

  // Enable Sentry Logs
  enableLogs: true,

  // Filter out noise
  ignoreErrors: [
    // Prisma connection errors (handled by our retry logic)
    "P1001",
    "P1002",
    "P1008",
    "P1017",
    // Rate limit errors (expected)
    "RATE_LIMITED",
  ],

  // Before send hook - scrub sensitive data
  beforeSend(event, hint) {
    // Remove sensitive data from request
    if (event.request) {
      // Redact headers
      if (event.request.headers) {
        const sensitiveHeaders = ["authorization", "cookie", "x-api-key", "x-passcode"];
        for (const header of sensitiveHeaders) {
          if (event.request.headers[header]) {
            event.request.headers[header] = "[REDACTED]";
          }
        }
      }

      // Redact body
      if (event.request.data && typeof event.request.data === "object") {
        const sensitiveFields = ["password", "passcode", "token", "secret", "apiKey", "otp"];
        for (const field of sensitiveFields) {
          if (field in event.request.data) {
            (event.request.data as Record<string, unknown>)[field] = "[REDACTED]";
          }
        }
      }
    }

    return event;
  },

  // Custom tags
  initialScope: {
    tags: {
      service: "hashcode-reboot",
      component: "server",
    },
  },
});
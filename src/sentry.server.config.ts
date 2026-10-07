import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Data collection: conservative defaults, opt-in for PII
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Do NOT attach local variable values to stack frames (prevents PII/OTP leakage)
  includeLocalVariables: false,

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
        const sensitiveFields = ["password", "passcode", "token", "secret", "apiKey", "otp", "code", "email", "phone"];
        for (const field of sensitiveFields) {
          if (field in event.request.data) {
            (event.request.data as Record<string, unknown>)[field] = "[REDACTED]";
          }
        }
      }

      // Redact URL and query string (they may contain email, code, token, etc.)
      if (event.request.url) {
        try {
          const url = new URL(event.request.url);
          // Redact query parameters that may contain sensitive data
          url.searchParams.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            if (["email", "code", "token", "otp", "password", "passcode", "secret", "apiKey"].includes(lowerKey)) {
              url.searchParams.set(key, "[REDACTED]");
            }
          });
          event.request.url = url.toString();
        } catch {
          // If URL parsing fails, fallback to redacting the whole URL as a last resort
          event.request.url = "[REDACTED URL]";
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
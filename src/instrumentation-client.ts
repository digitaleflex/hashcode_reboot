import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Data collection: conservative defaults, opt-in for PII
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },

  // 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Session Replay: 10% of all sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Enable Sentry Logs
  enableLogs: true,

  // Filter out noise
  ignoreErrors: [
    // Browser extensions
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undefined elements",
    // Network errors (handled by our own logging)
    "NetworkError",
    "Failed to fetch",
    // Hydration mismatches (common in Next.js)
    "Hydration failed",
    "Text content does not match server-rendered HTML",
  ],

  // Before send hook - scrub sensitive data
  beforeSend(event, hint) {
    // Remove sensitive headers
    if (event.request?.headers) {
      const sensitiveHeaders = ["authorization", "cookie", "x-api-key", "x-passcode"];
      for (const header of sensitiveHeaders) {
        if (event.request.headers[header]) {
          event.request.headers[header] = "[REDACTED]";
        }
      }
    }

    // Remove sensitive data from user context
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }

    return event;
  },

  // Custom tags
  initialScope: {
    tags: {
      service: "hashcode-reboot",
      component: "client",
    },
  },

  integrations: [
    Sentry.replayIntegration(),
    // Optional: user feedback widget
    // Sentry.feedbackIntegration({ colorScheme: "system" }),
  ],
});

// Hook into App Router navigation transitions (App Router only)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
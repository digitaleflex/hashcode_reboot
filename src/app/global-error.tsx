"use client";

import { useEffect } from "react";
import { createClientLogger } from "@/lib/logging-client";
import { captureException } from "@/lib/sentry";

const logger = createClientLogger({ component: "GlobalError" });

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    const err = error as Error & { digest?: string };
    logger.error("Global error boundary caught", {
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
        digest: err.digest,
      },
    });

    // Send to Sentry for monitoring
    captureException(err, {
      component: "GlobalErrorBoundary",
      digest: err.digest,
    });
  }, [error]);

  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Erreur — HASHCODE REBOOT</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #0A0A0A; color: #F8FAFC; min-height: 100vh;
            display: flex; align-items: center; justify-content: center; padding: 24px;
          }
          .container { max-width: 480px; width: 100%; text-align: center; }
          .accent { color: #C5F441; }
          h1 { font-size: 28px; font-weight: 800; margin-bottom: 12px; line-height: 1.2; }
          p { font-size: 16px; line-height: 1.6; color: #94A3B8; margin-bottom: 24px; }
          .digest { font-family: monospace; font-size: 12px; color: #64748B; background: #141414; padding: 12px; border-radius: 8px; border: 1px solid #262626; margin-bottom: 24px; word-break: break-all; }
          button {
            background: #C5F441; color: #0A0A0A; border: none; border-radius: 8px;
            padding: 14px 28px; font-size: 16px; font-weight: 700; cursor: pointer;
            transition: transform 0.1s, box-shadow 0.1s;
          }
          button:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(197, 244, 65, 0.3); }
          button:active { transform: translateY(0); }
          .support { margin-top: 24px; font-size: 14px; color: #64748B; }
          .support a { color: #C5F441; text-decoration: none; }
          .support a:hover { text-decoration: underline; }
        `}</style>
      </head>
      <body>
        <div className="container">
          <h1>Une erreur s'est produite <span className="accent">😔</span></h1>
          <p>
            Quelque chose a mal tourné de notre côté. L'équipe a été notifiée automatiquement.
          </p>
          {error.digest && (
            <div className="digest">
              Référence : <strong>{error.digest}</strong>
            </div>
          )}
          <button onClick={reset}>Réessayer</button>
          <div className="support">
            Si le problème persiste, <a href="mailto:support@joinhashcode.com">contactez le support</a>
          </div>
        </div>
      </body>
    </html>
  );
}
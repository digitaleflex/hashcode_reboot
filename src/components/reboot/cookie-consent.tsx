"use client";

import * as React from "react";
import { RebootButton, MonoLabel } from "./shared";
import { X } from "lucide-react";

const CONSENT_KEY = "hashcode:reboot:consent";

/**
 * Lightweight cookie consent banner. Shows once (until the user accepts or
 * declines). Stores the choice in localStorage. We only set analytics cookies
 * after consent (the analytics tracking itself is fire-and-forget; this banner
 * is the legal/UX signal).
 */
export function CookieConsent() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function choose(choice: "accepted" | "declined") {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, ts: Date.now() }));
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-[84px] sm:bottom-6 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-50 animate-hash-slide-up">
      <div className="relative rounded-lg border border-border bg-card/95 backdrop-blur-sm p-4 sm:p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="shrink-0 size-8 rounded-md border border-lime/40 bg-lime/5 text-lime flex items-center justify-center mt-0.5">
            <span className="size-2 rounded-full bg-lime animate-hash-pulse" />
          </span>
          <div className="flex-1 min-w-0">
            <MonoLabel className="text-muted-foreground">Confidentialité</MonoLabel>
            <p className="mt-1 text-sm text-foreground leading-snug">
              HASHCODE utilise des cookies anonymes pour mesurer le parcours
              (entonnoir) et améliorer l&apos;expérience. Aucune publicité,
              aucune revente.
            </p>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <RebootButton size="md" onClick={() => choose("accepted")} className="w-full sm:w-auto">
                Accepter
              </RebootButton>
              <RebootButton
                size="md"
                variant="ghost"
                onClick={() => choose("declined")}
                className="w-full sm:w-auto"
              >
                Refuser
              </RebootButton>
            </div>
          </div>
          <button
            onClick={() => choose("declined")}
            className="shrink-0 min-h-[44px] min-w-[44px] -m-2 p-2 flex items-start justify-center text-muted-foreground hover:text-foreground transition-colors focus-lime rounded-md"
            aria-label="Fermer et refuser"
          >
            <X className="size-4 mt-2" />
          </button>
        </div>
      </div>
    </div>
  );
}

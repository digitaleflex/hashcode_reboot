"use client";

import * as React from "react";
import { MailCheck, Loader2, RefreshCw } from "lucide-react";

/** Bandeau non-bloquant pour l'écran de fin (Welcome) : lien déjà envoyé via POST /api/members. */
export function EmailVerificationNudge({ email, firstName }: { email: string; firstName: string }) {
  const [sending, setSending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [info, setInfo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    if (cooldown > 0 || sending) return;
    setSending(true);
    setInfo(null);
    setError(null);
    try {
      const res = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === "COOLDOWN" && typeof data?.retryInSec === "number") {
          setCooldown(data.retryInSec);
          setError(`Lien déjà envoyé. Réessaie dans ${data.retryInSec} s.`);
        } else {
          setError(data?.error ?? "Envoi impossible. Réessaie.");
        }
        return;
      }
      setInfo("Nouveau lien envoyé — clique dedans (1 clic, 24 h).");
      setCooldown(60);
    } catch {
      setError("Envoi impossible. Vérifie ta connexion.");
    } finally {
      setSending(false);
    }
  }

  if (!email) return null;
  return (
    <div className="mt-6 rounded-lg border border-lime/40 bg-lime/[0.04] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <MailCheck className="size-5 text-lime shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground font-medium">Vérifie ton email — 1 clic suffit.</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            On t&apos;a envoyé un 2e email avec un lien magique à{" "}
            <span className="text-foreground">{email}</span> (avec ton invitation).
            Clique dedans pour confirmer — valide 24 h, pas de code à recopier.
          </p>
          {info && (
            <p className="mt-2 text-xs text-lime" role="status">
              {info}
            </p>
          )}
          {error && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0 || sending}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-lime hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {cooldown > 0 ? `Renvoyer dans ${cooldown}s` : "Renvoyer le lien"}
          </button>
        </div>
      </div>
    </div>
  );
}

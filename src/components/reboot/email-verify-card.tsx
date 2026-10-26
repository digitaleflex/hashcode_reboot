"use client";

import * as React from "react";
import { MailCheck, Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

/** Bandeau non-bloquant pour l'écran de fin (Welcome) : lien déjà envoyé via POST /api/members. */
export function EmailVerificationNudge({ email, firstName }: { email: string; firstName: string }) {
  const t = useTranslations("profiling");
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
          setError(t("emailVerify.cooldown", { seconds: data.retryInSec }));
        } else {
          setError(data?.error ?? t("emailVerify.sendFailed"));
        }
        return;
      }
      setInfo(t("emailVerify.sent"));
      setCooldown(60);
    } catch {
      setError(t("emailVerify.networkError"));
    } finally {
      setSending(false);
    }
  }

  if (!email) return null;
  return (
    // Rendu « nu » : le conteneur (carte, titre, numéro) est porté par la
    // checklist d'activation de la page de bienvenue.
    <div className="flex items-start gap-3">
        <MailCheck className="size-5 text-lime shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("emailVerify.description", { email })}
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
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-lime/40 bg-lime/[0.06] px-4 text-sm font-medium text-lime transition-colors hover:bg-lime/10 focus-lime disabled:opacity-50"
          >
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {cooldown > 0 ? t("emailVerify.resendCooldown", { seconds: cooldown }) : t("emailVerify.resend")}
          </button>
        </div>
    </div>
  );
}
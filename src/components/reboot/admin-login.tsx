"use client";

import * as React from "react";
import { Logo, HashSymbol } from "@/components/brand/logo";
import { RebootButton, MonoLabel } from "./shared";
import { ArrowLeft, Lock, AlertTriangle } from "lucide-react";

/**
 * Admin passcode gate. Shown when the user navigates to `?admin=1` but isn't
 * authenticated (no admin cookie or invalid cookie). After successful login
 * the parent re-mounts the AdminDashboard.
 */
export function AdminLogin({
  onAuthed,
  onExit,
}: {
  onAuthed: () => void;
  onExit: () => void;
}) {
  const [passcode, setPasscode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [showPasscode, setShowPasscode] = React.useState(false);
  const [cooldownSec, setCooldownSec] = React.useState(0);
  const [failedAttempts, setFailedAttempts] = React.useState(0);
  const [captchaRequired, setCaptchaRequired] = React.useState(false);
  const [captchaValue, setCaptchaValue] = React.useState("");

  // Cooldown 429 : décompte avec cleanup.
  React.useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setTimeout(() => setCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldownSec]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cooldownSec > 0) return;
    if (captchaRequired && !captchaValue.trim()) {
      setError("Veuillez résoudre le captcha.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcode.trim(), captcha: captchaValue.trim() || undefined }),
      });
      let data: { ok?: boolean; error?: string; code?: string } | null = null;
      try {
        data = (await res.json()) as { ok?: boolean; error?: string; code?: string };
      } catch {
        data = null;
      }
      if (!res.ok || !data?.ok) {
        const code = data?.code;
        if (res.status === 429 || code === "RATE_LIMITED") {
          const raw = res.headers.get("Retry-After");
          const parsed = raw !== null ? Number(raw) : NaN;
          const sec = Number.isFinite(parsed) ? parsed : 60;
          setCooldownSec(sec);
          setError(
            `${data?.error ?? "Trop de tentatives."} Réessaie dans ${sec}s.`,
          );
        } else if (res.status === 401 || code === "UNAUTHORIZED") {
          // Track failed attempts for captcha escalation.
          const nextAttempts = failedAttempts + 1;
          setFailedAttempts(nextAttempts);
          if (nextAttempts >= 3) {
            setCaptchaRequired(true);
            setError(
              `${data?.error ?? "Passcode invalide."} Captcha requis après 3 échecs.`,
            );
          } else {
            setError(data?.error ?? "Passcode invalide.");
          }
        } else {
          setError(data?.error ?? "Connexion échouée.");
        }
        setSubmitting(false);
        return;
      }
      // Success resets failed attempts.
      setFailedAttempts(0);
      setCaptchaRequired(false);
      setCaptchaValue("");
      onAuthed();
    } catch {
      setError("Connexion impossible. Réessaie.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background bg-vignette bg-noise">
      <div className="absolute inset-0 bg-grid opacity-50" aria-hidden />
      <div className="relative z-10 flex-1 flex items-center justify-center px-5">
        <div className="w-full max-w-sm">
          <div className="text-center animate-hash-in">
            <span className="inline-flex items-center justify-center size-12 rounded-md border border-lime/40 bg-lime/5 text-lime">
              <Lock className="size-5" />
            </span>
            <h1 className="mt-5 font-display font-bold text-2xl tracking-tight text-foreground">
              Accès admin
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Espace réservé. Entre ton passcode HASHCODE.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-7 space-y-3 animate-hash-in"
          >
            <div className="relative">
              <input
                type={showPasscode ? "text" : "password"}
                autoFocus
                autoComplete="current-password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Passcode"
                className="w-full h-12 rounded-md border bg-card px-4 pr-12 text-base text-foreground placeholder:text-muted-foreground transition-colors focus-lime border-border focus:border-lime"
              />
              <button
                type="button"
                onClick={() => setShowPasscode((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-lime transition-colors focus-lime mono-label"
                aria-label={showPasscode ? "Masquer" : "Afficher"}
                tabIndex={-1}
              >
                {showPasscode ? "MASQUER" : "AFFICHER"}
              </button>
            </div>

            {captchaRequired && (
              <div className="relative">
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Captcha (placeholder)
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={captchaValue}
                  onChange={(e) => setCaptchaValue(e.target.value)}
                  placeholder="Résoudre le captcha"
                  className="w-full h-10 rounded-md border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground transition-colors focus-lime border-border focus:border-lime"
                />
                <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-amber-500" />
              </div>
            )}

            {error && (
              <p
                className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-foreground animate-hash-in"
                role="alert"
              >
                <span className="text-destructive">{error}</span>
              </p>
            )}

            <RebootButton
              size="lg"
              type="submit"
              className="group w-full"
              disabled={submitting || !passcode.trim() || cooldownSec > 0 || (captchaRequired && !captchaValue.trim())}
            >
              {cooldownSec > 0
                ? `Patiente ${cooldownSec}s…`
                : submitting
                  ? "Vérification…"
                  : "Déverrouiller"}
            </RebootButton>
          </form>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={onExit}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus-lime"
            >
              <ArrowLeft className="size-4" />
              Retour au site
            </button>
            <MonoLabel className="text-muted-foreground">
              HASHCODE · REBOOT
            </MonoLabel>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground/80">
            Accès réservé aux administrateurs autorisés. Toutes les actions sont
            journalisées.
          </p>
        </div>
      </div>
    </div>
  );
}
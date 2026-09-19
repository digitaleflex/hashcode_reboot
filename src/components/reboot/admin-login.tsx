"use client";

import * as React from "react";
import { Logo } from "@/components/brand/logo";
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
  const [notice, setNotice] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [showPasscode, setShowPasscode] = React.useState(false);
  const [cooldownSec, setCooldownSec] = React.useState(0);
  const [failedAttempts, setFailedAttempts] = React.useState(0);
  const [captchaRequired, setCaptchaRequired] = React.useState(false);
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [turnstileLoaded, setTurnstileLoaded] = React.useState(false);
  const [turnstileError, setTurnstileError] = React.useState(false);

  const errorRef = React.useRef<HTMLDivElement>(null);
  const turnstileContainerRef = React.useRef<HTMLDivElement>(null);

  // Cooldown 429 : décompte avec cleanup.
  const [cooldownTotal, setCooldownTotal] = React.useState(0);
  React.useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setTimeout(() => setCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldownSec]);

  // Annonce la fin du cooldown aux lecteurs d'écran.
  React.useEffect(() => {
    if (cooldownSec === 0 && cooldownTotal > 0) {
      setNotice("Pause terminée. Tu peux réessayer.");
    }
  }, [cooldownSec]);

  // Donne le focus au message d'erreur pour les lecteurs d'écran.
  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  // Échap quitte vers le site (parcours clavier complet).
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onExit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  // Fonction pour rendre le widget Turnstile.
  function renderTurnstileWidget() {
    const container = turnstileContainerRef.current;
    if (!container || !(window as any).turnstile) return;

    try {
      ;(window as any).turnstile.ready(() => {
        const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
        if (!siteKey) {
          setTurnstileError(true);
          return;
        }
        ;(window as any).turnstile.render(container, {
          sitekey: siteKey,
          callback: (token: string) => {
            setCaptchaToken(token);
            setTurnstileError(false);
          },
          "error-callback": () => {
            setCaptchaToken(null);
            setTurnstileError(true);
          },
        });
      });
    } catch {
      setTurnstileError(true);
    }
  }

  // Charger le script Turnstile et rendre le widget.
  React.useEffect(() => {
    if (!captchaRequired || turnstileLoaded) return;

    if ((window as any).turnstile) {
      renderTurnstileWidget();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.onload = () => {
      setTurnstileLoaded(true);
      renderTurnstileWidget();
    };
    script.onerror = () => {
      setTurnstileError(true);
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [captchaRequired, turnstileLoaded]);

  // Nettoyer le widget Turnstile au démontage.
  React.useEffect(() => {
    return () => {
      if ((window as any).turnstile && turnstileContainerRef.current) {
        try {
          ;(window as any).turnstile.remove(turnstileContainerRef.current);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cooldownSec > 0) return;
    if (captchaRequired && !captchaToken) {
      setError("Saisis le code de vérification demandé ci-dessous.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcode.trim(), captchaToken: captchaToken || undefined }),
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
          setCooldownTotal(sec);
          setCooldownSec(sec);
          setError(
            `${data?.error ?? "Trop de tentatives."} Pause anti-abus de ${sec} secondes avant de réessayer. Tes saisies sont conservées.`,
          );
        } else if (res.status === 401 || code === "UNAUTHORIZED") {
          // Track failed attempts for captcha escalation.
          const nextAttempts = failedAttempts + 1;
          setFailedAttempts(nextAttempts);
          if (nextAttempts >= 3) {
            setCaptchaRequired(true);
            setError(
              `${data?.error ?? "Passcode invalide."} Saisis aussi le code de vérification ci-dessous.`,
            );
          } else {
            setError(
              `${data?.error ?? "Passcode invalide."} (${3 - nextAttempts} essai${3 - nextAttempts > 1 ? "s" : ""} avant vérification supplémentaire.)`,
            );
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
      setCaptchaToken(null);
      try {
        window.localStorage.setItem("hashcode-admin-session-start", String(Date.now()));
      } catch {
        /* stockage indisponible : la session reste valable 12h côté serveur */
      }
      onAuthed();
    } catch {
      setError("Connexion impossible. Vérifie ta connexion puis réessaie.");
      setSubmitting(false);
    }
  }

  const cooldownPct =
    cooldownTotal > 0
      ? Math.max(0, Math.min(100, (cooldownSec / cooldownTotal) * 100))
      : 0;
  const describedBy = [
    cooldownSec > 0 ? "login-cooldown-text" : null,
    error ? "login-error" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="min-h-screen flex flex-col bg-background bg-vignette bg-noise">
      <div className="absolute inset-0 bg-grid opacity-50" aria-hidden />
      <div className="relative z-10 flex-1 flex items-center justify-center px-5">
        <div className="w-full max-w-sm">
          <div className="text-center animate-hash-in">
            <span className="inline-flex items-center justify-center size-12 rounded-md border border-lime/40 bg-lime/5 text-lime">
              <Lock className="size-5" aria-hidden />
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
            className="mt-7 space-y-4 animate-hash-in"
            noValidate={false}
          >
            <div>
              <label
                htmlFor="admin-passcode"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Passcode admin
              </label>
              <div className="relative">
                <input
                  id="admin-passcode"
                  type={showPasscode ? "text" : "password"}
                  autoFocus
                  autoComplete="current-password"
                  spellCheck={false}
                  enterKeyHint="go"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Ton passcode"
                  aria-describedby={describedBy || undefined}
                  aria-invalid={error ? true : undefined}
                  className="w-full h-12 rounded-md border bg-card px-4 pr-24 text-base text-foreground placeholder:text-muted-foreground transition-colors focus-lime border-border focus:border-lime"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((s) => !s)}
                  aria-pressed={showPasscode}
                  aria-controls="admin-passcode"
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] px-2 text-xs text-muted-foreground hover:text-lime transition-colors focus-lime mono-label rounded-sm"
                  aria-label={showPasscode ? "Masquer le passcode" : "Afficher le passcode"}
                  title={showPasscode ? "Masquer le passcode" : "Afficher le passcode"}
                >
                  {showPasscode ? "MASQUER" : "AFFICHER"}
                </button>
              </div>
            </div>

            {captchaRequired && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Vérification humaine
                  <span aria-hidden="true"> *</span>
                </label>
                <div ref={turnstileContainerRef} className="turnstile-container" />
                {turnstileError && !captchaToken && (
                  <p className="mt-1.5 text-xs leading-relaxed text-amber-400">
                    Le captcha n'a pas pu se charger. Rafraîchis la page ou demande un code à ton responsable.
                  </p>
                )}
                {captchaToken && (
                  <p className="mt-1.5 text-xs leading-relaxed text-lime">
                    ✅ Vérification humaine validée.
                  </p>
                )}
                <p id="captcha-help" className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Après 3 passcodes invalides, cette vérification est exigée en plus du passcode.
                </p>
              </div>
            )}

            {error && (
              <div ref={errorRef} tabIndex={-1} className="focus-lime rounded-md outline-none">
                <p
                  id="login-error"
                  className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-foreground animate-hash-in"
                  role="alert"
                >
                  <span className="text-destructive">{error}</span>
                </p>
              </div>
            )}

            {cooldownSec > 0 && (
              <div
                id="login-cooldown"
                role="status"
                aria-live="polite"
                className="rounded-md border border-amber-500/40 bg-amber-500/[0.06] p-3"
              >
                <p id="login-cooldown-text" className="text-xs leading-relaxed text-foreground tabular-nums">
                  Pause anti-abus : réessaie dans {cooldownSec}s
                  {cooldownTotal > 0 ? ` (sur ${cooldownTotal}s)` : ""}.
                  Inutile de recharger la page.
                </p>
                <div
                  className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden"
                  role="progressbar"
                  aria-label="Temps de pause restant"
                  aria-valuemin={0}
                  aria-valuemax={cooldownTotal || 100}
                  aria-valuenow={cooldownSec}
                  aria-valuetext={`${cooldownSec} secondes restantes`}
                >
                  <div
                    className="h-full bg-amber-400 transition-all duration-1000"
                    style={{ width: `${cooldownPct}%` }}
                    aria-hidden
                  />
                </div>
              </div>
            )}

            {notice && cooldownSec === 0 && (
              <p role="status" aria-live="polite" className="text-xs text-lime">
                {notice}
              </p>
            )}

            <RebootButton
              size="lg"
              type="submit"
              className="group w-full"
              disabled={submitting || !passcode.trim() || cooldownSec > 0 || (captchaRequired && !captchaToken)}
            >
              {cooldownSec > 0
                ? `Patiente ${cooldownSec}s…`
                : submitting
                  ? "Vérification…"
                  : "Déverrouiller"}
            </RebootButton>
            <p aria-live="polite" role="status" className="sr-only">
              {submitting ? "Vérification du passcode en cours." : ""}
            </p>
          </form>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-muted-foreground hover:text-foreground transition-colors focus-lime rounded-sm px-1"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Retour au site
            </button>
            <MonoLabel className="text-muted-foreground">
              Session 12h
            </MonoLabel>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground/80">
            Accès réservé. Session valable 12h. Toutes les actions sont
            journalisées.
          </p>
        </div>
      </div>
    </div>
  );
}

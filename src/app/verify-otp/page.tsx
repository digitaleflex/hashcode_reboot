"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { Logo, HashSymbol } from "@/components/brand/logo";
import { RebootButton, MonoLabel } from "@/components/reboot/shared";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 60;

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  // Anti open-redirect : n'accepte que les chemins internes (pas d'URL externe, pas de //).
  const rawNext = searchParams.get("next") || "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  // Lien magique 1-clic : ?code=123456 pré-remplit et auto-soumet (même session OTP).
  const linkCode = (searchParams.get("code") ?? "").replace(/\D/g, "").slice(0, OTP_LENGTH);
  const autoSubmitRef = React.useRef(false);
  const [digits, setDigits] = React.useState<string[]>(
    Array(OTP_LENGTH).fill(""),
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = React.useState(RESEND_COOLDOWN_SEC);
  const inputsRef = React.useRef<Array<HTMLInputElement | null>>([]);

  // Cooldown pour "Renvoyer le code"
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Si pas d'email, retour à /login
  React.useEffect(() => {
    if (!email) {
      router.replace("/login");
    }
  }, [email, router]);

  const code = digits.join("");
  const canSubmit = code.length === OTP_LENGTH && !loading;

  function setDigit(index: number, value: string) {
    const v = value.replace(/\D/g, "").slice(0, 1);
    setDigits((d) => {
      const next = [...d];
      next[index] = v;
      return next;
    });
    if (v && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newDigits = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i];
    setDigits(newDigits);
    const lastIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputsRef.current[lastIdx]?.focus();
  }

  async function submit(codeToSubmit: string) {
    if (codeToSubmit.length !== OTP_LENGTH || loading) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: codeToSubmit }),
      });
      if (res.ok) {
        // Cookie posé par le serveur, on redirige
        router.push(next);
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.code === "INVALID_CODE" || data.code === "LOCKED") {
        setError(data.error ?? "Code invalide ou expiré.");
        // Vider les inputs pour que l'user retape
        setDigits(Array(OTP_LENGTH).fill(""));
        inputsRef.current[0]?.focus();
      } else if (data.code === "RATE_LIMITED") {
        setError(
          data.error ?? "Trop de tentatives. Réessaie dans quelques minutes.",
        );
      } else {
        setError(data.error ?? "Une erreur est survenue. Réessaie.");
      }
    } catch {
      setError("Erreur réseau. Vérifie ta connexion.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-submit quand les 6 chiffres sont saisis
  React.useEffect(() => {
    if (code.length === OTP_LENGTH) {
      void submit(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Lien magique : pré-remplit depuis ?code= et soumet une seule fois.
  // Puis nettoie l'URL (retire ?code= de l'historique pour limiter l'exposition).
  React.useEffect(() => {
    if (autoSubmitRef.current) return;
    if (linkCode.length !== OTP_LENGTH || !email) return;
    autoSubmitRef.current = true;
    setDigits(linkCode.split(""));
    setInfo("Lien détecté — connexion automatique…");
    void submit(linkCode);
    try {
      const params = new URLSearchParams(window.location.search);
      params.delete("code");
      const clean = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, "", clean);
    } catch {
      /* best-effort */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkCode, email]);

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/auth/request-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setError(
            data.error ?? "Trop de demandes. Réessaie dans quelques minutes.",
          );
        } else {
          setError(data.error ?? "Impossible de renvoyer le code.");
        }
        return;
      }
      setInfo("Un nouveau code + lien ont été envoyés. Ils expirent dans 15 minutes.");
      setResendCooldown(RESEND_COOLDOWN_SEC);
      setDigits(Array(OTP_LENGTH).fill(""));
      inputsRef.current[0]?.focus();
    } catch {
      setError("Erreur réseau. Vérifie ta connexion.");
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <HashSymbol className="mx-auto text-lime" size={36} />
        <h1 className="mt-4 text-2xl sm:text-3xl font-display font-bold tracking-tight">
          Saisis ton code
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          On a envoyé un code à 6 chiffres + un lien 1-clic à{" "}
          <strong className="text-foreground">{email}</strong>.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void submit(code);
        }}
        className="space-y-5"
      >
        <div>
          <MonoLabel className="text-muted-foreground">
            Code à 6 chiffres
          </MonoLabel>
          <div
            className="mt-2 flex items-center justify-between gap-2"
            onPaste={handlePaste}
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading}
                aria-label={`Chiffre ${i + 1}`}
                className="h-14 w-12 sm:w-14 text-center text-xl font-mono font-bold rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime transition-colors disabled:opacity-50"
              />
            ))}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {info && (
          <div
            role="status"
            className="rounded-md border border-lime/40 bg-lime/5 p-3 text-sm text-foreground"
          >
            {info}
          </div>
        )}

        <RebootButton
          type="submit"
          size="lg"
          className="w-full"
          disabled={!canSubmit}
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Vérification…
            </>
          ) : (
            "Valider"
          )}
        </RebootButton>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            <Mail className="size-3" />
            {resendCooldown > 0
              ? `Renvoyer le code (${resendCooldown}s)`
              : "Renvoyer le code"}
          </button>
        </div>
      </form>
    </div>
  );
}

function VerifyFallback() {
  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <HashSymbol className="mx-auto text-lime" size={36} />
        <h1 className="mt-4 text-2xl sm:text-3xl font-display font-bold tracking-tight">
          Saisis ton code
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Chargement…</p>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <a
          href="/login"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Retour
        </a>
        <Logo />
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <React.Suspense fallback={<VerifyFallback />}>
          <VerifyOtpForm />
        </React.Suspense>
      </div>
    </main>
  );
}

"use client";

import * as React from "react";
import { MailCheck, Loader2, RefreshCw } from "lucide-react";
import { RebootButton, MonoLabel } from "./shared";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

interface EmailVerifyCardProps {
  email: string;
  firstName: string;
  onVerified: (email: string) => void;
  onLater: () => void;
}

export function EmailVerifyCard({ email, firstName, onVerified, onLater }: EmailVerifyCardProps) {
  const [code, setCode] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const sentForRef = React.useRef<string | null>(null);

  const sendCode = React.useCallback(async () => {
    setSending(true);
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
          setSent(true);
          setError(`Code déjà envoyé. Réessaie dans ${data.retryInSec} s.`);
        } else {
          setError(data?.error ?? "Envoi impossible. Réessaie.");
        }
        return;
      }
      setSent(true);
      sentForRef.current = email;
    } catch {
      setError("Envoi impossible. Vérifie ta connexion.");
    } finally {
      setSending(false);
    }
  }, [email, firstName]);

  // Envoi automatique à l'ouverture (une fois par email).
  React.useEffect(() => {
    if (sentForRef.current !== email) {
      void sendCode();
    }
  }, [email, sendCode]);

  // Décompte du cooldown de renvoi.
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleVerify() {
    if (code.trim().length !== 6) {
      setError("Saisis les 6 chiffres du code.");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/verify-email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Code incorrect. Réessaie.");
        return;
      }
      onVerified(email);
    } catch {
      setError("Vérification impossible. Vérifie ta connexion.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-5">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 sm:p-8 animate-hash-in">
        <div className="text-center">
          <MailCheck className="mx-auto text-lime" size={36} />
          <MonoLabel className="mt-4 text-lime">VÉRIFIE TON EMAIL</MonoLabel>
          <h2 className="mt-2 font-display font-bold text-xl sm:text-2xl tracking-tight">
            On t&apos;a envoyé un code
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Saisis le code à 6 chiffres envoyé à{" "}
            <span className="text-foreground font-medium">{email}</span>.
            {" "}Il expire dans 10 minutes.
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(v) => {
              setCode(v);
              setError(null);
              if (v.length === 6) {
                // Vérification auto dès que le code est complet.
                void (async () => {
                  setVerifying(true);
                  try {
                    const res = await fetch("/api/verify-email/confirm", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email, code: v.trim() }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || !data?.ok) {
                      setError(data?.error ?? "Code incorrect. Réessaie.");
                      return;
                    }
                    onVerified(email);
                  } catch {
                    setError("Vérification impossible. Vérifie ta connexion.");
                  } finally {
                    setVerifying(false);
                  }
                })();
              }
            }}
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <RebootButton
            size="lg"
            className="group w-full"
            onClick={handleVerify}
            disabled={verifying || code.trim().length !== 6}
          >
            {verifying ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Vérification…
              </>
            ) : (
              "Vérifier mon email"
            )}
          </RebootButton>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (cooldown > 0 || sending) return;
                setCode("");
                void sendCode();
              }}
              disabled={cooldown > 0 || sending}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-lime transition-colors disabled:opacity-50 min-h-[32px]"
            >
              {sending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {cooldown > 0 ? `Renvoyer dans ${cooldown}s` : sent ? "Renvoyer le code" : "Envoyer le code"}
            </button>
            <button
              type="button"
              onClick={onLater}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[32px] px-2"
            >
              Vérifier plus tard
            </button>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          Pas reçu ? Vérifie tes spams ou renvoie un nouveau code.
        </p>
      </div>
    </div>
  );
}

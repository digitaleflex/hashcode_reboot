"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, ShieldCheck, AlertCircle, Copy, Check, KeyRound } from "lucide-react";
import { adminAuthClient, adminTwoFactor } from "@/lib/auth/admin-client";
import { Logo } from "@/components/brand/logo";

/**
 * Enrôlement 2FA (TOTP) — page atteinte :
 *   1. juste après l'activation d'une invitation operator (setup → ici) ;
 *   2. à chaque connexion d'un operator sans 2FA (forçage serveur dans
 *      AdminLayout — la 2FA est obligatoire pour les operators).
 *
 * Le secret est généré par Better Auth (`/two-factor/enable`) et chiffré au
 * repos. Le QR code est rendu LOCALEMENT (qrcode.react) : le secret ne
 * transite par aucun service tiers.
 */

type Phase = "checking" | "password" | "scan" | "done";

export default function AdminSetup2faPage() {
  const router = useRouter();

  const [phase, setPhase] = React.useState<Phase>("checking");
  const [error, setError] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [totpUri, setTotpUri] = React.useState("");
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [codesSaved, setCodesSaved] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // ── Session requise : sans elle, rien à enroler ────────────────────────
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: session } = await adminAuthClient.getSession();
        if (cancelled) return;
        if (!session?.user) {
          router.replace("/admin/login?next=%2Fadmin%2Fsetup-2fa");
          return;
        }
        if (session.user.twoFactorEnabled) {
          // Déjà enrolé : direction le dashboard.
          router.replace("/admin/dashboard");
          return;
        }
        setPhase("password");
      } catch {
        if (!cancelled) setPhase("password");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const { data, error: enableError } = await adminTwoFactor.enable({
        password,
        issuer: "HASHCODE Admin",
      });

      if (enableError) {
        const code = (enableError as { code?: string }).code;
        setError(
          code === "INVALID_PASSWORD"
            ? "Mot de passe incorrect — confirme-le pour activer la 2FA."
            : "Activation impossible. Réessaye.",
        );
        return;
      }

      if (data?.totpURI) {
        setTotpUri(data.totpURI);
        setBackupCodes(data.backupCodes ?? []);
        setPhase("scan");
      } else {
        setError("Réponse inattendue du serveur. Réessaye.");
      }
    } catch {
      setError("Activation impossible. Réessaye.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const { error: verifyError } = await adminTwoFactor.verifyTotp({
        code: code.trim(),
        trustDevice: true,
      });

      if (verifyError) {
        setError("Code invalide — vérifie l'heure de ton téléphone et réessaie.");
        return;
      }

      setPhase("done");
      router.refresh();
    } catch {
      setError("Vérification impossible. Réessaye.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <a href="/" aria-label="HASHCODE — accueil">
            <Logo className="h-10 w-auto text-lime" />
          </a>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          {phase === "checking" && (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-lime" aria-hidden />
              <p className="text-sm text-muted-foreground">Vérification de la session…</p>
            </div>
          )}

          {phase === "password" && (
            <>
              <div className="text-center mb-8">
                <ShieldCheck className="mx-auto size-10 text-lime mb-3" aria-hidden />
                <h1 className="text-2xl font-bold text-foreground">Sécurise ton compte</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  L'authentification à deux facteurs est obligatoire pour les opérateurs
                </p>
              </div>

              {error && <ErrorBanner message={error} />}

              <form onSubmit={handleEnable} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="2fa-password" className="mono-label text-xs text-muted-foreground block mb-1">
                    Confirme ton mot de passe
                  </label>
                  <input
                    id="2fa-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={busy}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
                    placeholder="••••••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-md bg-lime px-4 py-2.5 text-sm font-medium text-lime-foreground hover:bg-lime/90 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Configurer la 2FA
                </button>
              </form>
            </>
          )}

          {phase === "scan" && (
            <>
              <div className="text-center mb-6">
                <ShieldCheck className="mx-auto size-10 text-lime mb-3" aria-hidden />
                <h1 className="text-2xl font-bold text-foreground">Scanne le QR code</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Google Authenticator, 1Password, Authy… toute app TOTP fonctionne
                </p>
              </div>

              {error && <ErrorBanner message={error} />}

              {totpUri && (
                <div className="mb-6 flex justify-center">
                  <div className="rounded-lg bg-white p-3 border border-border">
                    <QRCodeSVG value={totpUri} size={180} level="M" />
                  </div>
                </div>
              )}

              {backupCodes.length > 0 && (
                <div className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs font-medium text-foreground">
                      Codes de secours — affichés UNE SEULE FOIS
                    </p>
                    <button
                      type="button"
                      onClick={() => setCodesSaved(true)}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      {codesSaved ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {codesSaved ? "Noté" : "Copier"}
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
                    {backupCodes.map((c, i) => (
                      <kbd key={i} className="px-1.5 py-1 bg-background border border-border rounded text-center">
                        {c}
                      </kbd>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Chaque code sert une fois si tu perds ton téléphone. Note-les maintenant.
                  </p>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="2fa-code" className="mono-label text-xs text-muted-foreground block mb-1">
                    Code à 6 chiffres
                  </label>
                  <input
                    id="2fa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                    disabled={busy}
                    className="w-full rounded-md border border-input bg-background px-3 py-3 text-center text-xl tracking-[0.5em] font-mono focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
                    placeholder="••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy || code.length < 6}
                  className="w-full rounded-md bg-lime px-4 py-2.5 text-sm font-medium text-lime-foreground hover:bg-lime/90 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Activer la 2FA
                </button>
              </form>
            </>
          )}

          {phase === "done" && (
            <div className="text-center py-6">
              <ShieldCheck className="mx-auto size-16 text-lime mb-4" aria-hidden />
              <h1 className="text-2xl font-bold text-foreground mb-2">2FA activée</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Ton compte est protégé. Un code te sera demandé à chaque connexion.
              </p>
              <button
                type="button"
                onClick={() => router.push("/admin/dashboard")}
                className="w-full rounded-md bg-lime px-4 py-2.5 text-sm font-medium text-lime-foreground hover:bg-lime/90 transition-colors min-h-[44px] inline-flex items-center justify-center gap-2"
              >
                <KeyRound className="size-4" aria-hidden />
                Accéder au dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="mb-6 rounded-md border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2"
      role="alert"
    >
      <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" aria-hidden />
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}

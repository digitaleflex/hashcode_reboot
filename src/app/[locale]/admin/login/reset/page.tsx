"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, KeyRound, AlertCircle, CheckCircle2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { adminAuthClient } from "@/lib/auth/admin-client";
import { Logo } from "@/components/brand/logo";

/**
 * Réinitialisation du mot de passe admin — deux états sur la même route :
 *
 * 1. SANS token : formulaire de demande (email → lien de reset, anti-
 *    énumération : succès toujours affiché).
 * 2. AVEC token (lien cliqué depuis l'email) : formulaire du nouveau mot
 *    de passe (Better Auth `resetPassword`). La 2FA n'est PAS remise en
 *    cause (elle vit sur TwoFactor) — l'admin retrouve l'accès complet.
 */
export default function AdminPasswordResetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  if (token) {
    return <ResetWithToken token={token} />;
  }

  return <RequestForm />;

  function RequestForm() {
    const [email, setEmail] = React.useState("");
    const [sent, setSent] = React.useState(false);
    const [sending, setSending] = React.useState(false);
    const [reqError, setReqError] = React.useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setReqError(null);
      setSending(true);

      try {
        const { error: reqError } = await adminAuthClient.requestPasswordReset({
          email: email.trim().toLowerCase(),
          redirectTo: `${window.location.origin}/admin/login/reset`,
        });

        if (reqError) {
          // Cause exacte non exposée (anti-énumération) : échec technique
          // générique seulement.
          setReqError("Envoi impossible pour le moment. Réessaye dans quelques minutes.");
          return;
        }
        setSent(true);
      } catch {
        setReqError("Envoi impossible pour le moment. Réessaye dans quelques minutes.");
      } finally {
        setSending(false);
      }
    };

    if (sent) {
      return (
        <Shell>
          <div className="text-center py-4">
            <CheckCircle2 className="mx-auto size-12 text-lime mb-4" aria-hidden />
            <h1 className="text-xl font-bold text-foreground mb-2">Vérifie ta boîte mail</h1>
            <p className="text-sm text-muted-foreground">
              Si un compte admin existe pour <strong>{email.trim().toLowerCase()}</strong>, un lien
              de réinitialisation vient d'être envoyé. Il expire dans 1 heure.
            </p>
            <button
              type="button"
              onClick={() => router.push("/admin/login")}
              className="mt-6 w-full rounded-md border border-border bg-card px-4 py-2.5 text-sm text-foreground hover:border-lime/60 hover:text-lime transition-colors min-h-[44px]"
            >
              Retour à la connexion
            </button>
          </div>
        </Shell>
      );
    }

    return (
      <Shell>
        <div className="text-center mb-8">
          <KeyRound className="mx-auto size-10 text-lime mb-3" aria-hidden />
          <h1 className="text-2xl font-bold text-foreground">Mot de passe oublié</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reçois un lien de réinitialisation par email (valide 1 heure)
          </p>
        </div>

        {reqError && <ErrorBanner message={reqError} />}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="reset-email" className="mono-label text-xs text-muted-foreground block mb-1">
              Email du compte admin
            </label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={sending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
              placeholder="admin@hashcode.fr"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-md bg-lime px-4 py-2.5 text-sm font-medium text-lime-foreground hover:bg-lime/90 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
          >
            {sending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Envoyer le lien
          </button>

          <button
            type="button"
            onClick={() => router.push("/admin/login")}
            className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Retour à la connexion
          </button>
        </form>
      </Shell>
    );
  }

  function ResetWithToken({ token }: { token: string }) {
    const [password, setPassword] = React.useState("");
    const [confirm, setConfirm] = React.useState("");
    const [showPassword, setShowPassword] = React.useState(false);
    const [done, setDone] = React.useState(false);
    const [resetError, setResetError] = React.useState<string | null>(null);
    const [resetting, setResetting] = React.useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setResetError(null);

      if (password.length < 12) {
        setResetError("Le mot de passe doit faire au moins 12 caractères.");
        return;
      }
      if (password !== confirm) {
        setResetError("Les mots de passe ne correspondent pas.");
        return;
      }

      setResetting(true);
      try {
        const { error: resetErr } = await adminAuthClient.resetPassword({
          newPassword: password,
          token,
        });

        if (resetErr) {
          setResetError("Lien invalide ou expiré. Redemande un lien de réinitialisation.");
          return;
        }
        setDone(true);
        // Connexion implicite après reset (Better Auth renvoie une session
        // fraîche) : direction le login 2FA ou le dashboard.
        window.setTimeout(() => {
          router.push("/admin/login");
          router.refresh();
        }, 1500);
      } catch {
        setResetError("Réinitialisation impossible. Réessaye.");
      } finally {
        setResetting(false);
      }
    };

    if (done) {
      return (
        <Shell>
          <div className="text-center py-4">
            <CheckCircle2 className="mx-auto size-12 text-lime mb-4" aria-hidden />
            <h1 className="text-xl font-bold text-foreground mb-2">Mot de passe mis à jour</h1>
            <p className="text-sm text-muted-foreground">Redirection vers la connexion…</p>
          </div>
        </Shell>
      );
    }

    return (
      <Shell>
        <div className="text-center mb-8">
          <KeyRound className="mx-auto size-10 text-lime mb-3" aria-hidden />
          <h1 className="text-2xl font-bold text-foreground">Nouveau mot de passe</h1>
          <p className="text-sm text-muted-foreground mt-1">
            12 caractères minimum — la 2FA existante reste active
          </p>
        </div>

        {resetError && <ErrorBanner message={resetError} />}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="new-password" className="mono-label text-xs text-muted-foreground block mb-1">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={resetting}
                className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className="mono-label text-xs text-muted-foreground block mb-1">
              Confirmer le mot de passe
            </label>
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={resetting}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={resetting}
            className="w-full rounded-md bg-lime px-4 py-2.5 text-sm font-medium text-lime-foreground hover:bg-lime/90 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
          >
            {resetting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Enregistrer le mot de passe
          </button>
        </form>
      </Shell>
    );
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <a href="/" aria-label="HASHCODE — accueil">
            <Logo className="h-10 w-auto text-lime" />
          </a>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm">{children}</div>
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

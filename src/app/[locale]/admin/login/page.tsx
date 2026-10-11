"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff, Shield, AlertCircle, KeyRound, ArrowLeft } from "lucide-react";
import { adminAuthClient, adminTwoFactor, setTwoFactorRedirectHandler } from "@/lib/auth/admin-client";
import { Logo } from "@/components/brand/logo";

/**
 * Connexion admin nominative — email + mot de passe, puis code 2FA (TOTP)
 * si le compte l'a activée (optionnelle, désactivée par défaut).
 *
 * Better Auth renvoie `twoFactorRedirect` après un sign-in réussi quand la
 * 2FA est active : le handler global (setTwoFactorRedirectHandler) bascule
 * alors le formulaire sur l'étape du code. Aucun secret ne transite par
 * cette page — tout vit dans le cookie HttpOnly de session admin.
 */

type Step = "credentials" | "totp";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin/dashboard";

  const [step, setStep] = React.useState<Step>("credentials");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [totp, setTotp] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  // Le handler 2FA doit être enregistré AVANT tout sign-in ( Better Auth
  // intercepte la réponse `twoFactorRedirect` côté client).
  React.useEffect(() => {
    setTwoFactorRedirectHandler(() => {
      setStep("totp");
      setError(null);
    });
    return () => setTwoFactorRedirectHandler(null);
  }, []);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await adminAuthClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
        rememberMe,
        callbackURL: next,
      });

      if (signInError) {
        const code = (signInError as { code?: string }).code;
        if (code === "TWO_FACTOR_REQUIRED" || code === "INVALID_TWO_FACTOR_COOKIE") {
          setStep("totp");
          return;
        }
        setError(mapError(code, (signInError as { status?: number }).status));
        return;
      }

      // Succès sans 2FA : redirection (rafraîchit le cache RSC).
      router.push(next);
      router.refresh();
    } catch {
      setError("Connexion impossible. Vérifie ta connexion et réessaye.");
    } finally {
      setLoading(false);
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: verifyError } = await adminTwoFactor.verifyTotp({
        code: totp.trim(),
        trustDevice: rememberMe,
      });

      if (verifyError) {
        const code = (verifyError as { code?: string }).code;
        setError(mapError(code, (verifyError as { status?: number }).status));
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError("Vérification impossible. Réessaye.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <a href="/" aria-label="HASHCODE — accueil">
            <Logo className="h-10 w-auto text-lime" />
          </a>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          {step === "credentials" ? (
            <>
              <div className="text-center mb-8">
                <Shield className="mx-auto size-10 text-lime mb-3" aria-hidden />
                <h1 className="text-2xl font-bold text-foreground">Espace admin</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Connexion nominative — email + mot de passe
                </p>
              </div>

              {error && <ErrorBanner message={error} />}

              <form onSubmit={handleCredentialsSubmit} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="admin-email" className="mono-label text-xs text-muted-foreground block mb-1">
                    Email
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
                    placeholder="admin@hashcode.fr"
                  />
                </div>

                <div>
                  <label htmlFor="admin-password" className="mono-label text-xs text-muted-foreground block mb-1">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm placeholder:text-muted-foreground focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPassword ? <EyeOff className="size-6" /> : <Eye className="size-6" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                    className="size-4 rounded border-border text-lime focus:ring-lime"
                  />
                  <span className="text-sm text-foreground">Rester connecté (30 jours)</span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 rounded-md bg-lime px-4 py-2.5 text-sm font-medium text-lime-foreground hover:bg-lime/90 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Se connecter
                </button>
              </form>

              <div className="mt-6 text-center">
                <a
                  href="/admin/login/reset"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-lime transition-colors"
                >
                  <KeyRound className="size-3.5" aria-hidden />
                  Mot de passe oublié ?
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-8">
                <Shield className="mx-auto size-10 text-lime mb-3" aria-hidden />
                <h1 className="text-2xl font-bold text-foreground">Vérification 2FA</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Entre le code à 6 chiffres de ton application d'authentification
                </p>
              </div>

              {error && <ErrorBanner message={error} />}

              <form onSubmit={handleTotpSubmit} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="admin-totp" className="mono-label text-xs text-muted-foreground block mb-1">
                    Code à 6 chiffres
                  </label>
                  <input
                    id="admin-totp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={totp}
                    onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
                    required
                    disabled={loading}
                    autoFocus
                    className="w-full rounded-md border border-input bg-background px-3 py-3 text-center text-xl tracking-[0.5em] font-mono focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
                    placeholder="••••••"
                  />
                  <p className="mt-2 text-xs text-muted-foreground text-center">
                    Tu peux aussi utiliser un code de secours (8 caractères).
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || totp.length < 6}
                  className="w-full mt-2 rounded-md bg-lime px-4 py-2.5 text-sm font-medium text-lime-foreground hover:bg-lime/90 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Vérifier et entrer
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("credentials");
                    setTotp("");
                    setError(null);
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
                >
                  <ArrowLeft className="size-3.5" aria-hidden />
                  Revenir à l'identifiant
                </button>
              </form>
            </>
          )}

          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              Accès réservé à l'équipe HASHCODE.{" "}
              <a href="/mentions-legales" className="underline hover:text-lime">
                Mentions légales
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="mb-6 rounded-md border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2 animate-hash-in"
      role="alert"
    >
      <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" aria-hidden />
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}

/** Codes Better Auth → messages curatés (aucun texte serveur exposé). */
function mapError(code?: string, status?: number): string {
  switch (code) {
    case "INVALID_EMAIL":
    case "INVALID_PASSWORD":
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_CREDENTIALS":
      return "Email ou mot de passe incorrect.";
    case "USER_NOT_FOUND":
    case "USER_ALREADY_EXISTS":
      return "Email ou mot de passe incorrect.";
    case "EMAIL_NOT_VERIFIED":
      return "Ton adresse email n'est pas encore vérifiée.";
    case "ACCOUNT_NOT_FOUND":
      return "Aucun compte admin pour cet email — une invitation est nécessaire.";
    case "BANNED_USER":
      return "Ce compte est suspendu. Contacte un autre opérateur.";
    case "INVALID_CODE":
    case "INVALID_TOTP":
      return "Code invalide ou expiré.";
    case "TOO_MANY_ATTEMPTS":
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
      return "Trop de tentatives. Patiente quelques minutes.";
    case "ACCOUNT_TEMPORARILY_LOCKED":
      return "Compte temporairement verrouillé après trop d'échecs.";
    case "RATE_LIMITED":
      return "Trop de requêtes — patiente une minute.";
    default:
      if (status === 429) return "Trop de requêtes — patiente une minute.";
      if (status && status >= 500) return "Service momentanément indisponible. Réessaye.";
      return "Connexion refusée. Vérifie tes identifiants.";
  }
}

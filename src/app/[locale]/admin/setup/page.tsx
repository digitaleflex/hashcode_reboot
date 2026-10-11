"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck, AlertCircle, Eye, EyeOff } from "lucide-react";
import { adminAuthClient } from "@/lib/auth/admin-client";
import { Logo } from "@/components/brand/logo";

/**
 * Activation d'une invitation admin (/admin/setup?token=xxx).
 *
 * 1. Le jeton est vérifié côté serveur (GET /api/admin/invite/verify).
 * 2. Le formulaire appelle le sign-up Better Auth — le hook
 *    `databaseHooks.user.create` (src/lib/auth/admin.ts) valide à nouveau
 *    l'invitation en base, vérifie l'email et pose le rôle. Aucun compte ne
 *    peut être créé sans invitation : le endpoint sign-up est public mais
 *    gardé par ce hook.
 * 3. autoSignIn:true → session immédiate → redirection directe vers le
 *    dashboard. La 2FA est OPTIONNELLE (désactivée par défaut) : l'admin
 *    peut l'activer plus tard depuis /admin/settings.
 */

type Invitation = {
  email: string;
  name: string | null;
  role: "operator" | "viewer";
  expiresAt: string;
};

export default function AdminSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [invitation, setInvitation] = React.useState<Invitation | null>(null);
  const [loadingInvite, setLoadingInvite] = React.useState(true);
  const [inviteError, setInviteError] = React.useState<string | null>(null);

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // ── Vérification du jeton ──────────────────────────────────────────────
  React.useEffect(() => {
    if (!token) {
      setInviteError("Lien d'invitation invalide — jeton manquant.");
      setLoadingInvite(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/invite/verify?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data?.ok) {
          setInviteError(mapInviteError(data?.error));
          return;
        }
        setInvitation(data as Invitation);
      } catch {
        if (!cancelled) setInviteError("Vérification impossible. Réessaye plus tard.");
      } finally {
        if (!cancelled) setLoadingInvite(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !token) return;
    setError(null);

    if (password.length < 12) {
      setError("Le mot de passe doit faire au moins 12 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setSubmitting(true);
    try {
      // Sign-up Better Auth — le hook serveur revalide l'invitation (email +
      // rôle + consumed). L'email vient du jeton vérifié, pas d'un champ
      // utilisateur libre.
      const { error: signUpError } = await adminAuthClient.signUp.email({
        email: invitation.email,
        password,
        name: invitation.name || invitation.email.split("@")[0],
      });

      if (signUpError) {
        const code = (signUpError as { code?: string }).code;
        setError(mapSignUpError(code));
        return;
      }

      // Session créée (autoSignIn) : direction le dashboard. La 2FA est
      // optionnelle — l'admin l'active plus tard s'il le souhaite.
      router.push("/admin/dashboard");
      router.refresh();
    } catch {
      setError("Activation impossible. Réessaye.");
    } finally {
      setSubmitting(false);
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
          {loadingInvite ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-lime" aria-hidden />
              <p className="text-sm text-muted-foreground">Vérification de l'invitation…</p>
            </div>
          ) : inviteError || !invitation ? (
            <div className="text-center py-6">
              <AlertCircle className="mx-auto size-12 text-destructive mb-4" aria-hidden />
              <h1 className="text-xl font-bold text-foreground mb-2">Invitation inutilisable</h1>
              <p className="text-sm text-muted-foreground mb-6">
                {inviteError ?? "Ce lien d'invitation n'est plus valide."}
              </p>
              <a
                href="/admin/login"
                className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2.5 text-sm text-foreground hover:border-lime/60 hover:text-lime transition-colors min-h-[44px]"
              >
                Aller à la connexion
              </a>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <ShieldCheck className="mx-auto size-10 text-lime mb-3" aria-hidden />
                <h1 className="text-2xl font-bold text-foreground">Active ton accès admin</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {invitation.email} — rôle{" "}
                  <strong className="text-foreground">
                    {invitation.role === "operator" ? "Opérateur" : "Lecteur"}
                  </strong>
                </p>
              </div>

              {error && (
                <div
                  className="mb-6 rounded-md border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2"
                  role="alert"
                >
                  <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" aria-hidden />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="setup-password" className="mono-label text-xs text-muted-foreground block mb-1">
                    Mot de passe (12 caractères minimum)
                  </label>
                  <div className="relative">
                    <input
                      id="setup-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={submitting}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
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

                <div>
                  <label htmlFor="setup-confirm" className="mono-label text-xs text-muted-foreground block mb-1">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="setup-confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    disabled={submitting}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
                    placeholder="••••••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md bg-lime px-4 py-2.5 text-sm font-medium text-lime-foreground hover:bg-lime/90 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Créer mon compte
                </button>

                <p className="text-xs text-muted-foreground text-center">
                  La 2FA est optionnelle — tu pourras l&apos;activer depuis les
                  paramètres après ta première connexion.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function mapInviteError(code?: string): string {
  switch (code) {
    case "EXPIRED":
      return "Cette invitation a expiré (7 jours). Demande une nouvelle invitation à un opérateur.";
    case "ALREADY_ACCEPTED":
      return "Cette invitation a déjà été utilisée. Connecte-toi directement.";
    case "NOT_FOUND":
      return "Lien d'invitation inconnu.";
    default:
      return "Lien d'invitation invalide.";
  }
}

function mapSignUpError(code?: string): string {
  switch (code) {
    case "USER_ALREADY_EXISTS":
      return "Un compte existe déjà pour cet email — connecte-toi directement.";
    case "INVALID_EMAIL":
    case "INVALID_PASSWORD":
      return "Email ou mot de passe invalide (12 caractères minimum).";
    case "FAILED_TO_CREATE_USER":
      return "Création refusée : l'invitation n'est plus valide. Demande une nouvelle invitation.";
    default:
      return "Activation refusée. Vérifie le lien reçu par email.";
  }
}

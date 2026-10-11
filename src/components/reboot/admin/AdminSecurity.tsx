"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff, Loader2, AlertCircle, KeyRound } from "lucide-react";
import { adminAuthClient, adminTwoFactor } from "@/lib/auth/admin-client";
import { RebootButton, MonoLabel } from "@/components/reboot/shared";

/**
 * Sécurité du compte admin courant — gestion OPTIONNELLE de la 2FA.
 *
 * La 2FA est désactivée par défaut : aucun forçage serveur. Cette section
 * permet à l'admin de l'activer (→ `/admin/setup-2fa`) ou de la désactiver
 * (confirmation par mot de passe, exigée par Better Auth `two-factor/disable`).
 */
export function AdminSecurity() {
  const router = useRouter();
  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [disabling, setDisabling] = React.useState(false);
  const [showDisable, setShowDisable] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await adminAuthClient.getSession();
        if (cancelled) return;
        setTwoFactorEnabled(Boolean(data?.user?.twoFactorEnabled));
      } catch {
        if (!cancelled) setTwoFactorEnabled(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDisabling(true);
    try {
      const { error: err } = await adminTwoFactor.disable({ password });
      if (err) {
        const code = (err as { code?: string }).code;
        setError(
          code === "INVALID_PASSWORD"
            ? "Mot de passe incorrect."
            : "Désactivation impossible. Réessaye.",
        );
        return;
      }
      setTwoFactorEnabled(false);
      setShowDisable(false);
      setPassword("");
      router.refresh();
    } catch {
      setError("Désactivation impossible. Réessaye.");
    } finally {
      setDisabling(false);
    }
  };

  return (
    <section
      aria-label="Sécurité du compte"
      className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <KeyRound className="size-4 text-lime" aria-hidden />
        <MonoLabel className="text-muted-foreground">Sécurité du compte</MonoLabel>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            {twoFactorEnabled ? (
              <ShieldCheck className="size-5 text-lime mt-0.5 shrink-0" aria-hidden />
            ) : (
              <ShieldOff className="size-5 text-muted-foreground mt-0.5 shrink-0" aria-hidden />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                Authentification à deux facteurs (2FA) —{" "}
                <span className={twoFactorEnabled ? "text-lime" : "text-muted-foreground"}>
                  {twoFactorEnabled ? "activée" : "désactivée"}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">
                {twoFactorEnabled
                  ? "Un code de ton application d'authentification (TOTP) est demandé à chaque connexion."
                  : "Recommandée mais optionnelle. Ajoute un code TOTP en plus de ton mot de passe."}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {twoFactorEnabled ? (
              <RebootButton
                variant="outline"
                size="sm"
                onClick={() => setShowDisable((v) => !v)}
                className="gap-1.5"
              >
                <ShieldOff className="size-4" aria-hidden />
                Désactiver
              </RebootButton>
            ) : (
              <RebootButton
                size="sm"
                onClick={() => router.push("/admin/setup-2fa")}
                className="gap-1.5"
              >
                <ShieldCheck className="size-4" aria-hidden />
                Activer la 2FA
              </RebootButton>
            )}
          </div>
        </div>
      )}

      {showDisable && (
        <form
          onSubmit={handleDisable}
          className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-3"
        >
          <p className="text-xs text-muted-foreground">
            Confirme ton mot de passe pour désactiver la 2FA (les codes de secours
            seront invalidés).
          </p>
          {error && (
            <div className="flex items-start gap-2 text-destructive" role="alert">
              <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden />
              <span className="text-xs">{error}</span>
            </div>
          )}
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={disabling}
            placeholder="Ton mot de passe"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
          />
          <div className="flex gap-2">
            <RebootButton type="submit" size="sm" disabled={disabling} className="gap-1.5">
              {disabling && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Confirmer la désactivation
            </RebootButton>
            <RebootButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowDisable(false);
                setPassword("");
                setError(null);
              }}
            >
              Annuler
            </RebootButton>
          </div>
        </form>
      )}
    </section>
  );
}

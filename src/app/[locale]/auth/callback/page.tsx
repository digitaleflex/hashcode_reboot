"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { AuthLayout } from "@/components/auth/auth-layout";
import { authClient } from "@/lib/auth/client";
import { sanitizeNext } from "@/lib/auth-ui";

export const dynamic = "force-dynamic";

/**
 * Répartition post-OAuth (Google) — Better Auth a déjà créé la session User.
 *
 * - Member existant (même email) → `next` (ex /dashboard, /admin).
 * - Nouveau venu (User sans Member — le profil exige ~10 champs NOT NULL que
 *   Google ne fournit pas) → `/` pour créer son profil via le parcours
 *   habituel, avec l'email pré-rempli.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get("next"));
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await authClient.getSession();
        const email = data?.user?.email?.trim().toLowerCase();
        if (!email) {
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        // Sonde Member (fail-closed : toute erreur ⇒ retour login).
        const res = await fetch("/api/account/me", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!cancelled && res.ok) {
          router.replace(next);
          router.refresh();
          return;
        }
        if (!cancelled) {
          router.replace(`/?email=${encodeURIComponent(email)}`);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  return (
    <AuthLayout
      step={2}
      title="Connexion…"
      subtitle="Finalisation de ta connexion Google."
      backHref={`/login?next=${encodeURIComponent(next)}`}
      backLabel="Retour"
    >
      {failed ? (
        <p className="text-center text-sm text-destructive">
          Connexion impossible.{" "}
          <a href={`/login?next=${encodeURIComponent(next)}`} className="underline">
            Réessaie
          </a>
          .
        </p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">Chargement…</p>
      )}
    </AuthLayout>
  );
}

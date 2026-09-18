"use client";

import * as React from "react";

/**
 * État de session membre côté client.
 *
 * Les pages publiques (landing, événements, connexion) doivent savoir si un
 * membre est connecté, sinon un membre qui quitte l'espace membre voit une
 * interface anonyme et croit avoir été déconnecté. Le serveur, lui, a déjà
 * l'information : cette sonde ne fait que la lire.
 *
 * Une seule requête par montage, aucune donnée de profil (juste le prénom).
 */

export type MemberSession =
  | { status: "loading"; firstName: null }
  | { status: "anonymous"; firstName: null }
  | { status: "authenticated"; firstName: string | null };

const INITIAL: MemberSession = { status: "loading", firstName: null };

export function useMemberSession(): MemberSession {
  const [session, setSession] = React.useState<MemberSession>(INITIAL);

  React.useEffect(() => {
    const ctrl = new AbortController();

    fetch("/api/auth/session", { cache: "no-store", signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("session probe failed");
        return (await res.json()) as { authenticated?: boolean; firstName?: string | null };
      })
      .then((data) => {
        setSession(
          data.authenticated
            ? { status: "authenticated", firstName: data.firstName ?? null }
            : { status: "anonymous", firstName: null },
        );
      })
      .catch((err: unknown) => {
        // Requête annulée (démontage) : on ne touche pas à l'état.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // En cas de panne, on n'affiche pas « connecté » à tort.
        setSession({ status: "anonymous", firstName: null });
      });

    return () => ctrl.abort();
  }, []);

  return session;
}

"use client";

import * as React from "react";
import { DashboardErrorFallback } from "@/components/reboot/DashboardErrorFallback";

/**
 * Frontière d'erreur du segment /dashboard.
 *
 * Capture les erreurs de rendu des pages serveur du dashboard (accueil,
 * agenda, profil, paramètres…) et propose un retry via `reset()` — sans
 * exposer la stack au client. `error.digest` est l'identifiant serveur
 * corrélé aux logs (voir global-error.tsx pour le même motif).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[dashboard] render error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-4xl w-full px-5 sm:px-8 py-8">
      <DashboardErrorFallback onRetry={reset} />
    </div>
  );
}

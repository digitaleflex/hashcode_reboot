import * as React from "react";
import {
  CheckCircle2,
  Clock,
  Hourglass,
  XCircle,
  Users,
} from "lucide-react";
import type { AccountStatus } from "@/app/account/_components/types";

/**
 * Carte statut — état du profil + de la communauté.
 * Server component.
 */
export function StatusCard({ status }: { status: AccountStatus }) {
  const profileIcon = {
    APPROVED: <CheckCircle2 className="size-5 text-lime" />,
    PENDING: <Clock className="size-5 text-amber-400" />,
    WAITLIST: <Hourglass className="size-5 text-blue-400" />,
    REJECTED: <XCircle className="size-5 text-red-400" />,
  }[status.profileStatus];

  const profileLabel = {
    APPROVED: "Validé",
    PENDING: "En attente",
    WAITLIST: "Liste d'attente",
    REJECTED: "Non retenu",
  }[status.profileStatus];

  const communityLabel = {
    NOT_INVITED: "Pas encore invité",
    INVITED: "Invité",
    JOINED: "Inscrit",
  }[status.communityStatus as keyof typeof communityLabel] ?? status.communityStatus;

  return (
    <section className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6 space-y-4">
      <h2 className="font-display font-bold text-sm tracking-tight mono-label text-muted-foreground uppercase">
        Statut
      </h2>

      <div className="space-y-3">
        {/* Profil */}
        <div className="flex items-center gap-3">
          {profileIcon}
          <div>
            <p className="text-sm font-medium">Profil</p>
            <p className="text-xs text-muted-foreground">{profileLabel}</p>
          </div>
        </div>

        {/* Communauté */}
        <div className="flex items-center gap-3">
          <Users className="size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Communauté</p>
            <p className="text-xs text-muted-foreground">{communityLabel}</p>
          </div>
        </div>

        {/* Accès */}
        <div className="flex items-center gap-3">
          <div
            className={`size-5 rounded-full flex items-center justify-center text-xs font-bold ${
              status.accessLane === "immediate"
                ? "bg-lime/20 text-lime"
                : "bg-amber-500/20 text-amber-400"
            }`}
          >
            {status.accessLane === "immediate" ? "✓" : "…"}
          </div>
          <div>
            <p className="text-sm font-medium">Accès</p>
            <p className="text-xs text-muted-foreground">
              {status.accessLane === "immediate" ? "Immédiat" : "En attente"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

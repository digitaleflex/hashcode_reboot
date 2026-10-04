import * as React from "react";
import { CircleDot, CheckCircle2, XCircle, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Badge de statut — un seul composant pour les 5 états possibles.
 *
 * Règle : TEXTE + ICÔNE + couleur. Jamais la couleur seule.
 * Le lime est réservé aux états « actifs » (en cours) et au CTA ;
 * le rose reste réservé à « Ça m'intéresse ».
 */

type StatusKey = "scheduled" | "live" | "completed" | "cancelled" | "full";

const STATUS: Record<
  StatusKey,
  { label: string; icon: React.ReactNode; className: string }
> = {
  scheduled: {
    label: "À venir",
    icon: <Clock className="size-3.5" aria-hidden />,
    className: "border-border text-muted-foreground",
  },
  live: {
    label: "En cours",
    icon: <CircleDot className="size-3.5" aria-hidden />,
    className: "border-lime/50 bg-lime/10 text-lime",
  },
  completed: {
    label: "Terminé",
    icon: <CheckCircle2 className="size-3.5" aria-hidden />,
    className: "border-border text-muted-foreground",
  },
  cancelled: {
    label: "Annulé",
    icon: <XCircle className="size-3.5" aria-hidden />,
    className: "border-destructive/50 bg-destructive/10 text-destructive",
  },
  full: {
    label: "Complet",
    icon: <Users className="size-3.5" aria-hidden />,
    className: "border-border bg-secondary/60 text-foreground",
  },
};

/**
 * @param status statut brut de l'API (`scheduled` | `live` | `completed` | `cancelled`)
 * @param isFull pas de place restante → force l'état « Complet » si l'événement est encore à venir
 */
export function EventStatusBadge({
  status,
  isFull = false,
  className,
}: {
  status: string;
  isFull?: boolean;
  className?: string;
}) {
  const key: StatusKey =
    isFull && status === "scheduled" ? "full" : ((status as StatusKey) in STATUS ? (status as StatusKey) : "scheduled");
  const conf = STATUS[key];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium leading-none",
        conf.className,
        className,
      )}
    >
      {conf.icon}
      {conf.label}
    </span>
  );
}

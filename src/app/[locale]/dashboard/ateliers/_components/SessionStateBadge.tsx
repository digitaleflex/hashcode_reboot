import { Lock, Circle, Loader, Send, Eye, Wrench, XCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Badge d'état d'une séance Atelier — purement présentatif (server-safe).
 *
 * Les états VIENNENT DU SERVEUR (GET /api/workshops*, dérivés par
 * workshop-progression.ts) : ce composant n'affiche jamais un état
 * calculé côté client.
 */

const STATE_CONFIG: Record<
  string,
  { labelKey: string; className: string; icon: React.ReactNode }
> = {
  LOCKED: {
    labelKey: "badgeLocked",
    className: "bg-secondary text-muted-foreground border-border/60",
    icon: <Lock className="size-3 shrink-0" />,
  },
  NOT_STARTED: {
    labelKey: "badgeNotStarted",
    className: "bg-secondary text-foreground border-border/60",
    icon: <Circle className="size-3 shrink-0" />,
  },
  IN_PROGRESS: {
    labelKey: "badgeInProgress",
    className: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    icon: <Loader className="size-3 shrink-0" />,
  },
  SUBMITTED: {
    labelKey: "badgeSubmitted",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    icon: <Send className="size-3 shrink-0" />,
  },
  IN_REVIEW: {
    labelKey: "badgeInReview",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    icon: <Eye className="size-3 shrink-0" />,
  },
  REVISION: {
    labelKey: "badgeRevision",
    className: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    icon: <Wrench className="size-3 shrink-0" />,
  },
  REJECTED: {
    labelKey: "badgeRejected",
    className: "bg-red-500/10 text-red-400 border-red-500/30",
    icon: <XCircle className="size-3 shrink-0" />,
  },
  COMPLETED: {
    labelKey: "badgeCompleted",
    className: "bg-lime/10 text-lime border-lime/30",
    icon: <CheckCircle2 className="size-3 shrink-0" />,
  },
};

export function SessionStateBadge({
  state,
  className,
  t,
}: {
  state: string;
  className?: string;
  t: (key: string) => string;
}) {
  const config = STATE_CONFIG[state] ?? STATE_CONFIG.NOT_STARTED;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        config.className,
        className,
      )}
    >
      {config.icon}
      {t(config.labelKey)}
    </span>
  );
}
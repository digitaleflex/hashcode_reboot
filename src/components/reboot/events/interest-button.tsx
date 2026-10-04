"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Signal d'intérêt anonyme — le seul accent rose de la page.
 *
 * - Toggle : un second clic annule l'intérêt (le compteur redescend et
 *   `localStorage` est mis à jour).
 * - Le compteur reste VISIBLE en permanence (c'était le défaut précédent :
 *   le bouton disparaissait au profit d'un span statique).
 * - Rose réservé : aucun autre élément de la page ne l'utilise.
 */
export function InterestButton({
  eventId,
  eventTitle,
  active,
  count,
  onToggle,
  className,
}: {
  eventId: string;
  eventTitle: string;
  active: boolean;
  count: number;
  onToggle: (eventId: string, nextActive: boolean) => void;
  className?: string;
}) {
  const [pop, setPop] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function handleClick() {
    // Micro-pulsation du cœur (~150ms) — remise à zéro par minuterie pour
    // rester compatible `prefers-reduced-motion` (la transition CSS est
    // neutralisée par le navigateur, pas par JS).
    setPop(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPop(false), 150);
    onToggle(eventId, !active);
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={
        active
          ? `Annuler mon intérêt pour ${eventTitle}`
          : `Ça m'intéresse pour ${eventTitle}`
      }
      onClick={handleClick}
      className={cn(
        "group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border px-3.5",
        "text-sm font-medium leading-none transition-colors duration-150 focus-lime cursor-pointer",
        active
          ? "border-pink-500/50 bg-pink-500/10 text-pink-300 hover:bg-pink-500/20"
          : "border-pink-500/30 text-muted-foreground hover:border-pink-500/60 hover:text-pink-300",
        className,
      )}
    >
      <Heart
        aria-hidden
        strokeWidth={2}
        className={cn(
          "size-4 transition-transform duration-150 ease-out",
          active && "fill-current",
          pop && "scale-125",
        )}
      />
      <span>{active ? "Intéressé" : "Ça m'intéresse"}</span>
      {count > 0 && (
        <span
          aria-hidden
          className={cn(
            "rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums transition-colors",
            active ? "bg-pink-500/15 text-pink-200" : "bg-secondary text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
      {/* Compteur annoncé sans dépendre de la pastille visuelle. */}
      <span className="sr-only">
        {count > 0 ? ` — ${count} personne${count > 1 ? "s" : ""} intéressée${count > 1 ? "s" : ""}` : ""}
      </span>
    </button>
  );
}

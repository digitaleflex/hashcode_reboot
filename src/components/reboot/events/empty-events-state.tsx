import { CalendarX2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * État « aucun résultat ». Deux variantes :
 * - `variant="empty"` : aucun événement du tout (état vide du site)
 * - `variant="filtered"` : des événements existent mais les filtres les excluent
 */
export function EmptyEventsState({
  variant = "empty",
  hasActiveFilters = false,
  onReset,
  className,
}: {
  variant?: "empty" | "filtered";
  hasActiveFilters?: boolean;
  onReset?: () => void;
  className?: string;
}) {
  const isFiltered = variant === "filtered";

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-border/70 px-6 py-14 text-center",
        className,
      )}
    >
      <CalendarX2 className="size-8 text-muted-foreground/50" aria-hidden />
      <p className="mt-4 text-[15px] font-medium text-foreground">
        {isFiltered ? "Aucun événement ne correspond à ces filtres." : "Aucun événement à venir pour le moment."}
      </p>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {isFiltered
          ? "Élargis ta recherche ou réinitialise les filtres pour voir toute la programmation."
          : "Les prochaines sessions seront annoncées ici. Reviens bientôt, ou rejoins la communauté pour ne rien rater."}
      </p>
      {isFiltered && hasActiveFilters && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:border-lime/50 hover:text-lime focus-lime cursor-pointer"
        >
          Réinitialiser les filtres
        </button>
      )}
    </div>
  );
}

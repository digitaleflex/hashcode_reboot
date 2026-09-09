import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback du segment /admin (stats, membres, événements, exports…).
 * Lignes de tableau génériques : le contenu exact arrive avec les
 * skeletons dédiés de chaque page (AdminStatsSkeleton, …).
 */
export default function AdminLoading() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-label="Chargement de l'administration"
    >
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="rounded-md border border-border/60 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-border/40 last:border-0"
          >
            <Skeleton className="size-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

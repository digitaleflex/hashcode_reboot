import { Skeleton } from "@/components/ui/skeleton";

export function ActivityLogSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Chargement de l'activité">
      <div className="rounded-md border border-border/60 bg-card/40 divide-y divide-border/40">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="size-2 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-3 w-16 shrink-0" />
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement de l’activité…</span>
    </div>
  );
}
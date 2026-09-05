import { Skeleton } from "@/components/ui/skeleton";

export function AdminStatsSkeleton() {
  return (
    <div role="status" aria-label="Chargement des statistiques" className="space-y-6">
      <div>
        <Skeleton className="h-4 w-28" />
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-border/60 border border-border/60 rounded-md overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-card p-4 sm:p-5 space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-md border border-border/60 bg-card p-4 sm:p-5 space-y-2.5"
          >
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement des statistiques…</span>
    </div>
  );
}
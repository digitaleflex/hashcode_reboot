import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton global pour le dashboard 360° — affiché pendant le premier chargement. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Chargement du dashboard" className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-6 w-20" />
      </div>

      {/* Health alerts banner */}
      <Skeleton className="h-16 w-full rounded-md" />

      {/* Stat cards (7 cols) */}
      <div>
        <Skeleton className="h-4 w-40 mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-border/60 border border-border/60 rounded-md overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-card p-4 sm:p-5 space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Invitations / file d'attente */}
      <Skeleton className="h-12 w-full rounded-md" />

      {/* Domain donut + breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-md" />
        ))}
      </div>

      {/* Email engagement */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-48 w-full rounded-md" />
      </div>

      {/* Email deliverability summary + ops */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-20 w-full rounded-md" />
        <Skeleton className="h-20 w-full rounded-md" />
        <Skeleton className="h-20 w-full rounded-md" />
      </div>

      {/* Provider quota cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Skeleton className="h-40 w-full rounded-md" />
        <Skeleton className="h-40 w-full rounded-md" />
      </div>

      {/* Cron health */}
      <Skeleton className="h-24 w-full rounded-md" />

      {/* Cohort retention */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 w-full rounded-md" />
      </div>

      {/* Login activity */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-28 w-full rounded-md" />
      </div>

      {/* Activity log */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export function AdminStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-2 w-1/2" />
        </div>
      ))}
    </div>
  );
}
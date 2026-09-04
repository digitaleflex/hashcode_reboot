import { Skeleton } from "@/components/ui/skeleton";

export function ActivityLogSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-32 mb-3" />
      <div className="space-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="size-6 rounded-full shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
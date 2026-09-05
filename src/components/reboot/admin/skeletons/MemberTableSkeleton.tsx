import { Skeleton } from "@/components/ui/skeleton";

export function MemberTableSkeleton() {
  return (
    <div role="status" aria-label="Chargement des membres" className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 p-3 rounded-md border border-border/60 bg-card/40">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
        <Skeleton className="h-9 flex-1 min-w-[180px] rounded-md" />
      </div>

      {/* Table */}
      <div className="rounded-md border border-border/60 bg-card/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm" aria-hidden="true">
            <thead>
              <tr className="border-b border-border/60 bg-secondary/30">
                {Array.from({ length: 7 }).map((_, i) => (
                  <th key={i} className="h-10 px-3 text-left">
                    <Skeleton className="h-4 w-16" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/40 last:border-b-0">
                  <td className="px-3 py-3">
                    <Skeleton className="h-5 w-36" />
                  </td>
                  <td className="px-3 py-3">
                    <Skeleton className="h-5 w-20" />
                  </td>
                  <td className="px-3 py-3">
                    <Skeleton className="h-5 w-16" />
                  </td>
                  <td className="px-3 py-3">
                    <Skeleton className="h-5 w-16" />
                  </td>
                  <td className="px-3 py-3">
                    <Skeleton className="h-5 w-20" />
                  </td>
                  <td className="px-3 py-3">
                    <Skeleton className="h-5 w-16" />
                  </td>
                  <td className="px-3 py-3">
                    <Skeleton className="h-5 w-14" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>
      <span className="sr-only">Chargement des membres…</span>
    </div>
  );
}
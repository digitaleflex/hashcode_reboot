import { Skeleton } from "@/components/ui/skeleton";

export function MemberTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-2">
          <Skeleton className="h-9 w-full sm:w-64" />
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border/60 bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/50">
              <th className="h-10 px-4 text-left font-medium text-muted-foreground">
                <Skeleton className="h-4 w-32" />
              </th>
              <th className="h-10 px-4 text-left font-medium text-muted-foreground">
                <Skeleton className="h-4 w-20" />
              </th>
              <th className="h-10 px-4 text-left font-medium text-muted-foreground">
                <Skeleton className="h-4 w-24" />
              </th>
              <th className="h-10 px-4 text-left font-medium text-muted-foreground">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="h-10 px-4 text-left font-medium text-muted-foreground">
                <Skeleton className="h-4 w-12" />
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-border/60 last:border-b-0">
                <td className="px-4 py-2.5">
                  <Skeleton className="h-5 w-40" />
                </td>
                <td className="px-4 py-2.5">
                  <Skeleton className="h-5 w-24" />
                </td>
                <td className="px-4 py-2.5">
                  <Skeleton className="h-5 w-20" />
                </td>
                <td className="px-4 py-2.5">
                  <Skeleton className="h-5 w-16" />
                </td>
                <td className="px-4 py-2.5">
                  <Skeleton className="h-4 w-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-1">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-20" />
        </div>
      </div>
    </div>
  );
}
import { cn } from "@/lib/utils";

/** Shaped placeholder — always sized like the content it stands in for. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} aria-hidden="true" {...props} />;
}

/** Loading body for any table: same row height and column count as the real one. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-border" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-12 items-center gap-4 px-5 sm:px-6">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn(
                "h-3.5",
                c === 0 ? "w-[28%]" : c === columns - 1 ? "ml-auto w-[14%]" : "w-[16%]"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Loading placeholder matching the StatCard footprint. */
export function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="size-9 rounded-sm" />
      </div>
      <Skeleton className="mt-4 h-8 w-36" />
      <Skeleton className="mt-3 h-3 w-28" />
    </div>
  );
}

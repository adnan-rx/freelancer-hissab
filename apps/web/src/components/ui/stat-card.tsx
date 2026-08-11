import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface StatCardProps {
  label: string;
  /** Already-formatted figure. Rendered in mono so KPI rows align. */
  value: React.ReactNode;
  /** Small unit or qualifier trailing the figure ("invoices", "PKR"). */
  unit?: string;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /**
   * Percentage change vs the previous period. `null` means there is nothing to
   * compare against yet — the delta is hidden rather than shown as 0%.
   */
  delta?: number | null;
  /** For expenses, a fall is the good outcome. */
  deltaGoodDirection?: "up" | "down";
  deltaLabel?: string;
  /** Emphasises the headline metric of a KPI row. */
  emphasis?: boolean;
  isLoading?: boolean;
  className?: string;
}

/**
 * The KPI tile used in every dashboard/report header. Hierarchy is fixed:
 * quiet label → large mono figure → one line of supporting context.
 */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  delta,
  deltaGoodDirection = "up",
  deltaLabel = "vs last month",
  emphasis,
  isLoading,
  className,
}: StatCardProps) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const isPositiveOutcome = hasDelta
    ? deltaGoodDirection === "up"
      ? delta! >= 0
      : delta! <= 0
    : false;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border bg-card p-5 shadow-xs transition-[border-color,box-shadow] duration-200 ease-smooth hover:border-border-strong hover:shadow-sm",
        emphasis ? "border-brand-200 bg-brand-50/40" : "border-border",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-tight text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-sm",
              emphasis ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
            aria-hidden="true"
          >
            <Icon className="size-4" />
          </span>
        )}
      </div>

      {/* A seven-figure PKR total has to survive a 250px-wide card, so the
          figure steps down before it ever reaches the card's edge. */}
      <div className="mt-4 flex min-w-0 items-baseline gap-1.5">
        {isLoading ? (
          <Skeleton className="h-8 w-36" />
        ) : (
          <>
            <span
              className={cn(
                "min-w-0 truncate font-mono text-2xl font-semibold leading-none tracking-[-0.03em] tabular-nums xl:text-[1.75rem]",
                emphasis ? "text-brand-900" : "text-foreground"
              )}
              title={typeof value === "string" || typeof value === "number" ? String(value) : undefined}
            >
              {value}
            </span>
            {unit && <span className="shrink-0 text-sm font-medium text-muted-foreground">{unit}</span>}
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        {hasDelta && !isLoading && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular",
              isPositiveOutcome ? "bg-success-surface text-success" : "bg-destructive-surface text-destructive"
            )}
          >
            {delta! >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta!)}%
          </span>
        )}
        <span className="text-xs text-muted-foreground">{hasDelta ? deltaLabel : hint}</span>
      </div>
    </div>
  );
}

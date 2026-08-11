import { AlertCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  /** Say what the user can do next, not just that there's nothing here. */
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  size?: "default" | "sm";
}

/** The one empty state in the app — inside tables, panels and whole pages. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = "default",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        size === "sm" ? "py-10" : "py-16",
        className
      )}
    >
      {Icon && (
        <span
          className={cn(
            "mb-4 flex items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground",
            size === "sm" ? "size-10" : "size-12"
          )}
          aria-hidden="true"
        >
          <Icon className={size === "sm" ? "size-5" : "size-6"} />
        </span>
      )}
      <p className={cn("font-semibold text-foreground", size === "sm" ? "text-sm" : "text-base")}>{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
      )}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Failure counterpart to EmptyState — same footprint, honest about the cause. */
export function ErrorState({
  title = "We couldn't load this",
  description = "Check your connection and try again.",
  action,
  className,
  size = "default",
}: Partial<EmptyStateProps>) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        size === "sm" ? "py-10" : "py-16",
        className
      )}
      role="alert"
    >
      <span
        className="mb-4 flex size-12 items-center justify-center rounded-lg border border-destructive/15 bg-destructive-surface text-destructive"
        aria-hidden="true"
      >
        <AlertCircle className="size-6" />
      </span>
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

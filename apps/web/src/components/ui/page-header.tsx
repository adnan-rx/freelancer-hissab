import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Small uppercase context label above the title. Used sparingly. */
  eyebrow?: React.ReactNode;
  /** Renders a back affordance — every detail/create screen needs a way out. */
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The single page-title block for every route. Title left, actions right,
 * stacking to full-width buttons on phones so nothing overflows.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  backHref,
  backLabel = "Back",
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between", className)}>
      <div className="min-w-0 space-y-1.5">
        {backHref && (
          <Link
            href={backHref}
            className="-ml-1 mb-1 inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
        )}
        {eyebrow && (
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-brand-600">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-[1.75rem]">{title}</h1>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-col gap-2 xs:flex-row xs:flex-wrap xs:items-center lg:justify-end [&>*]:w-full xs:[&>*]:w-auto">
          {actions}
        </div>
      )}
    </header>
  );
}

/** Section title inside a page — one step down from PageHeader. */
export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0 space-y-1">
        <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

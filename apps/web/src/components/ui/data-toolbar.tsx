"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Search box used above every table. Leading icon, clear affordance, and the
 * same 40px control height as Input/Select so filter rows line up.
 */
export const SearchInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
    value: string;
    onValueChange: (value: string) => void;
  }
>(({ className, value, onValueChange, placeholder = "Search…", ...props }, ref) => (
  <div className={cn("relative w-full sm:w-64", className)}>
    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
    <input
      ref={ref}
      type="search"
      role="searchbox"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "h-10 w-full rounded-md border border-input bg-card pl-9 pr-9 text-sm text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 ease-smooth",
        "placeholder:text-subtle hover:border-border-strong",
        "focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
        "[&::-webkit-search-cancel-button]:appearance-none"
      )}
      {...props}
    />
    {value && (
      <button
        type="button"
        onClick={() => onValueChange("")}
        aria-label="Clear search"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
      >
        <X className="size-3.5" />
      </button>
    )}
  </div>
));
SearchInput.displayName = "SearchInput";

/**
 * Filter row that sits directly above a table, inside its Card.
 * `filters` wrap onto their own line on narrow screens; `actions` stay right.
 */
export function DataToolbar({
  children,
  actions,
  className,
}: {
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>}
    </div>
  );
}

/** Small labelled control slot for a select/date filter inside DataToolbar. */
export function ToolbarFilter({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex items-center gap-2", className)}>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

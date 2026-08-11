"use client";

import { cn } from "@/lib/utils";

export interface SegmentedFilterOption {
  value: string;
  label: string;
}

/**
 * Inline single-choice filter used above tables (platform, status, type).
 * Scrolls rather than wrapping so a long option list never breaks the toolbar.
 */
export function SegmentedFilter({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: SegmentedFilterOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar rounded-md border border-border bg-muted p-1",
        className
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-8 shrink-0 whitespace-nowrap rounded-sm px-3 text-xs font-medium transition-[background-color,color,box-shadow] duration-150 ease-smooth",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              isActive
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

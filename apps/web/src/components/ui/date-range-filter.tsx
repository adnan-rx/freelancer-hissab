"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onClear: () => void;
  /** Rendered inline under the controls when start is after end. */
  invalid?: boolean;
  className?: string;
}

/** The one date-range control, shared by the ledger and the reports page. */
export function DateRangeFilter({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onClear,
  invalid,
  className,
}: DateRangeFilterProps) {
  const hasRange = !!(startDate || endDate);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Input
        type="date"
        value={startDate}
        onChange={(e) => onStartChange(e.target.value)}
        aria-label="From date"
        invalid={invalid}
        // Fixed-width date fields overflowed a 390px viewport; they share the
        // row's width there and only lock to a fixed size once there's room.
        className="min-w-0 flex-1 sm:w-[9.5rem] sm:flex-none"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="date"
        value={endDate}
        onChange={(e) => onEndChange(e.target.value)}
        aria-label="To date"
        invalid={invalid}
        // Fixed-width date fields overflowed a 390px viewport; they share the
        // row's width there and only lock to a fixed size once there's room.
        className="min-w-0 flex-1 sm:w-[9.5rem] sm:flex-none"
      />
      {hasRange && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X /> Clear
        </Button>
      )}
      {invalid && (
        <p className="w-full text-xs font-medium text-destructive" role="alert">
          The start date must come before the end date.
        </p>
      )}
    </div>
  );
}

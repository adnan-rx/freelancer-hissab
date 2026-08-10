"use client";

import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface SortState {
  key: string;
  direction: "asc" | "desc";
}

export interface SortableTableHeadProps {
  sortKey: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  className?: string;
  children: React.ReactNode;
}

/** Clickable TableHead that cycles asc -> desc -> unsorted for the given key. */
export function SortableTableHead({ sortKey, sort, onSort, className, children }: SortableTableHeadProps) {
  const active = sort?.key === sortKey;
  const Icon = active ? (sort!.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 select-none hover:text-foreground transition-colors",
          active && "text-foreground"
        )}
      >
        {children}
        <Icon className={cn("h-3.5 w-3.5", !active && "text-muted-foreground/60")} />
      </button>
    </TableHead>
  );
}

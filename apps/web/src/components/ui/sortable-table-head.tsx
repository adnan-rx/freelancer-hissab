"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
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
  /** Set for numeric columns so the header sits over the right-aligned figures. */
  align?: "left" | "right";
  children: React.ReactNode;
}

/** Clickable TableHead that cycles asc -> desc -> unsorted for the given key. */
export function SortableTableHead({
  sortKey,
  sort,
  onSort,
  className,
  align = "left",
  children,
}: SortableTableHeadProps) {
  const active = sort?.key === sortKey;
  const Icon = active ? (sort!.direction === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;

  return (
    <TableHead
      className={cn(
        // The button owns the padding, so re-apply the table's edge inset to it.
        "p-0 first:[&>button]:pl-5 last:[&>button]:pr-5 sm:first:[&>button]:pl-6 sm:last:[&>button]:pr-6",
        className
      )}
      aria-sort={active ? (sort!.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "group inline-flex h-10 w-full select-none items-center gap-1.5 px-4 text-2xs font-semibold uppercase tracking-[0.06em] transition-colors duration-150",
          "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70",
          align === "right" ? "justify-end" : "justify-start",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {children}
        <Icon
          className={cn(
            "size-3 shrink-0 transition-opacity duration-150",
            active ? "opacity-100" : "opacity-0 group-hover:opacity-60"
          )}
        />
      </button>
    </TableHead>
  );
}

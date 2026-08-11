"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  isFetching?: boolean;
  /** Omit to hide the rows-per-page control (server-paginated tables that fix it). */
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

/** Compact page list with ellipsis: 1 … 4 [5] 6 … 20 */
function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | "gap")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(totalPages - 1, page + 1);
  if (from > 2) out.push("gap");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < totalPages - 1) out.push("gap");
  out.push(totalPages);
  return out;
}

/** The single pagination footer used under every table in the app. */
export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  isFetching,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationBarProps) {
  if (total === 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col-reverse items-center justify-between gap-3 border-t border-border px-5 py-3 sm:flex-row sm:px-6"
    >
      <div className="flex items-center gap-4">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground tabular">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
          </span>{" "}
          of <span className="font-medium text-foreground tabular">{total.toLocaleString()}</span>
        </p>

        {onPageSizeChange && (
          <label className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span className="sr-only sm:not-sr-only">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 cursor-pointer rounded-sm border border-input bg-card px-2 text-xs font-medium text-foreground transition-colors hover:border-border-strong focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={page <= 1 || isFetching}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft />
        </Button>

        {/* Numbered pages need room; phones get the compact counter instead. */}
        <div className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, totalPages).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-subtle" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                disabled={isFetching}
                onClick={() => onPageChange(p)}
                className={cn(
                  "h-8 min-w-8 rounded-sm px-2 text-xs font-medium tabular transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {p}
              </button>
            )
          )}
        </div>

        <span className="px-2 text-xs font-medium text-muted-foreground tabular sm:hidden">
          {page} / {totalPages}
        </span>

        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={page >= totalPages || isFetching}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}

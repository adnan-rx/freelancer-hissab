import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Every table in the app shares this shell: sticky-capable muted header,
 * hairline row rules, 48px row height, right-aligned numerics.
 * Wrap in `<Card>` with `CardToolbar` above and `PaginationBar` below.
 */
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { containerClassName?: string }
>(({ className, containerClassName, ...props }, ref) => (
  <div className={cn("relative w-full overflow-x-auto thin-scrollbar", containerClassName)}>
    <table
      ref={ref}
      className={cn("w-full min-w-[38rem] caption-bottom border-collapse text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("bg-muted/60 [&_tr]:border-b [&_tr]:border-border", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={cn("border-t border-border-strong bg-muted/60 font-medium [&_tr]:border-0", className)} {...props} />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-border transition-colors duration-150 hover:bg-muted/50 data-[state=selected]:bg-brand-50",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 whitespace-nowrap px-4 text-left align-middle text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6 [&:has([role=checkbox])]:w-10 [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "h-12 px-4 align-middle text-sm text-foreground first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6 [&:has([role=checkbox])]:w-10 [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

/** Right-aligned money cell with mono digits — use for every PKR/USD column. */
const TableAmountCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & { tone?: "default" | "positive" | "negative" }
>(({ className, tone = "default", ...props }, ref) => (
  <TableCell
    ref={ref}
    className={cn(
      "text-right font-mono text-sm font-medium tabular-nums",
      tone === "positive" && "text-success",
      tone === "negative" && "text-destructive",
      className
    )}
    {...props}
  />
))
TableAmountCell.displayName = "TableAmountCell"

export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableAmountCell }

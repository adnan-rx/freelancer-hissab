"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Receipt, Upload } from "lucide-react";
import { CSVImportModal } from "@/components/features/csv-import-modal";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { SortableTableHead, SortState } from "@/components/ui/sortable-table-head";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { BulkActionsBar } from "@/components/ui/bulk-actions-bar";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { DataToolbar, SearchInput } from "@/components/ui/data-toolbar";
import { SegmentedFilter } from "@/components/ui/segmented-filter";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { useToast } from "@/providers/toast-provider";
import { useTransactions, TransactionType, TransactionSortKey, UnifiedTransaction } from "@/hooks/use-transactions";
import { useDeleteIncome } from "@/hooks/use-income";
import { useDeleteExpense } from "@/hooks/use-expenses";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const TYPE_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "INCOME", label: "Income" },
  { value: "EXPENSE", label: "Expenses" },
];

/** Selection key: a transaction's id is only unique within its own (income/expense) table. */
const txKey = (tx: UnifiedTransaction) => `${tx.type}:${tx.id}`;

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "ALL">("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<SortState | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const { showSuccess, showError } = useToast();

  const deleteIncomeMutation = useDeleteIncome();
  const deleteExpenseMutation = useDeleteExpense();

  // The input stays instant; the request that goes to the server (and the
  // page-1 reset below) waits for typing to pause. Every keystroke used to
  // fire its own paginated query.
  const debouncedSearch = useDebouncedValue(search);

  // Any filter change invalidates the current page — starting over on page 1
  // avoids landing on a now-empty page (e.g. filtering to a date range with fewer rows).
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter, startDate, endDate, sort, pageSize]);

  const { data, isLoading, isFetching } = useTransactions({
    search: debouncedSearch,
    type: typeFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize,
    // Sorted server-side now: this used to only reorder the 20 rows already
    // on the current page, so "sort by amount" looked plausible but was
    // actually sorting a date-sorted slice, not the full result set.
    sortBy: (sort?.key as TransactionSortKey) || undefined,
    sortDir: sort?.direction,
  });

  const total = data?.total ?? 0;
  const hasDateFilter = !!(startDate || endDate);
  const dateRangeInvalid = !!(startDate && endDate && startDate > endDate);
  const transactions = data?.data ?? [];
  const hasFilters = !!search || typeFilter !== "ALL" || hasDateFilter;

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  const pageKeys = transactions.map(txKey);
  const allSelectedOnPage = pageKeys.length > 0 && pageKeys.every((k) => selected.has(k));
  const someSelectedOnPage = pageKeys.some((k) => selected.has(k));

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) pageKeys.forEach((k) => next.delete(k));
      else pageKeys.forEach((k) => next.add(k));
      return next;
    });
  }

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const handleBulkDelete = async () => {
    const keys = Array.from(selected);
    setIsBulkDeleting(true);
    const results = await Promise.allSettled(
      keys.map((key) => {
        const [type, id] = key.split(":");
        return type === "INCOME" ? deleteIncomeMutation.mutateAsync(id) : deleteExpenseMutation.mutateAsync(id);
      })
    );
    setIsBulkDeleting(false);
    setBulkConfirmOpen(false);
    setSelected(new Set());

    const failed = results.filter((r) => r.status === "rejected").length;
    const deleted = keys.length - failed;
    if (failed === 0) {
      showSuccess(`${deleted} transaction${deleted === 1 ? "" : "s"} removed.`, "Transactions deleted");
    } else {
      showError(`${deleted} deleted, ${failed} could not be removed.`, "Some deletes failed");
    }
  };

  const clearAllFilters = () => {
    setSearch("");
    setTypeFilter("ALL");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="Ledger"
        description="Income and expenses in one chronological feed, across every platform and account."
        actions={
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload /> Import from Platforms
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {selected.size > 0 ? (
          <BulkActionsBar
            count={selected.size}
            onDelete={() => setBulkConfirmOpen(true)}
            onClear={() => setSelected(new Set())}
            isDeleting={isBulkDeleting}
            label="transaction"
          />
        ) : (
          <DataToolbar>
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search entity or description"
              aria-label="Search transactions"
              className="sm:w-64"
            />
            <SegmentedFilter
              options={TYPE_FILTERS}
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as TransactionType | "ALL")}
              ariaLabel="Filter by transaction type"
            />
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartChange={setStartDate}
              onEndChange={setEndDate}
              onClear={() => {
                setStartDate("");
                setEndDate("");
              }}
              invalid={dateRangeInvalid}
            />
          </DataToolbar>
        )}

        {isLoading ? (
          <TableSkeleton rows={8} columns={5} />
        ) : dateRangeInvalid ? (
          <EmptyState
            title="That date range doesn't work"
            description="The start date is after the end date. Adjust either end to see results."
            size="sm"
          />
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={hasFilters ? "No transactions match those filters" : "No transactions yet"}
            description={
              hasFilters
                ? "Widen the date range or clear the filters to see more."
                : "Log income or an expense and every entry lands here, newest first."
            }
            action={
              hasFilters ? (
                <Button variant="outline" onClick={clearAllFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Checkbox
                      checked={allSelectedOnPage}
                      indeterminate={someSelectedOnPage && !allSelectedOnPage}
                      onChange={toggleSelectAll}
                      aria-label="Select all transactions on this page"
                    />
                  </TableHead>
                  <SortableTableHead sortKey="date" sort={sort} onSort={toggleSort}>
                    Date
                  </SortableTableHead>
                  <SortableTableHead sortKey="entity" sort={sort} onSort={toggleSort}>
                    Entity
                  </SortableTableHead>
                  <TableHead>Description</TableHead>
                  <SortableTableHead sortKey="category" sort={sort} onSort={toggleSort}>
                    Category
                  </SortableTableHead>
                  <SortableTableHead sortKey="amount" sort={sort} onSort={toggleSort} align="right">
                    Amount
                  </SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const isIncome = tx.type === "INCOME";
                  const key = txKey(tx);
                  return (
                    <TableRow key={key} data-state={selected.has(key) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(key)}
                          onChange={() => toggleSelect(key)}
                          aria-label={`Select ${tx.entity || "transaction"}`}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground tabular">
                        {format(new Date(tx.date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{tx.entity}</TableCell>
                      <TableCell className="max-w-[16rem] truncate text-muted-foreground" title={tx.description}>
                        {tx.description || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral" className="capitalize">
                          {String(tx.category || "").replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      {/* Sign and colour carry the direction; an arrow on top of a
                          +/− was one cue too many and read as contradictory. */}
                      <TableCell
                        className={`whitespace-nowrap text-right font-mono text-sm font-medium tabular-nums ${
                          isIncome ? "text-success" : "text-foreground"
                        }`}
                      >
                        {isIncome ? "+" : "−"} {tx.currency}{" "}
                        {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              isFetching={isFetching}
            />
          </>
        )}
      </Card>

      <ConfirmModal
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selected.size} transaction${selected.size === 1 ? "" : "s"}?`}
        description="Each selected row is removed from its underlying income or expense log. This cannot be undone."
        confirmText="Delete selected"
        isLoading={isBulkDeleting}
      />

      <CSVImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </div>
  );
}

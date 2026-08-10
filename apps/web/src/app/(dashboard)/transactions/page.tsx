"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Search, Loader2, ArrowUpRight, ArrowDownRight, Filter, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { SortableTableHead, SortState } from "@/components/ui/sortable-table-head";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { BulkActionsBar } from "@/components/ui/bulk-actions-bar";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/providers/toast-provider";
import { useTransactions, TransactionType, TransactionSortKey, UnifiedTransaction } from "@/hooks/use-transactions";
import { useDeleteIncome } from "@/hooks/use-income";
import { useDeleteExpense } from "@/hooks/use-expenses";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const PAGE_SIZE = 20;

/** Selection key: a transaction's id is only unique within its own (income/expense) table. */
const txKey = (tx: UnifiedTransaction) => `${tx.type}:${tx.id}`;

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "ALL">("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
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
  }, [debouncedSearch, typeFilter, startDate, endDate, sort]);

  const { data, isLoading, isFetching } = useTransactions({
    search: debouncedSearch,
    type: typeFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize: PAGE_SIZE,
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
      showSuccess(`${deleted} transaction(s) removed.`, "Transactions Deleted");
    } else {
      showError(`${deleted} deleted, ${failed} failed.`, "Some Deletes Failed");
    }
  };

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Unified Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track all your business income and expenses chronologically in one place.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <CardTitle className="text-lg font-bold text-foreground hidden md:block">Transaction Feed</CardTitle>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search entity, description..."
                  className="pl-9 bg-background border-input text-foreground"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as TransactionType | "ALL")}
                  className="appearance-none bg-background border border-input text-foreground text-sm rounded-md px-3 py-2 pr-8 focus:outline-none focus:border-primary"
                >
                  <option value="ALL">All Types</option>
                  <option value="INCOME">Income Only</option>
                  <option value="EXPENSE">Expenses Only</option>
                </select>
                <Filter className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Date range:</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-auto bg-background border-input text-foreground text-sm h-9"
              aria-label="Start date"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-auto bg-background border-input text-foreground text-sm h-9"
              aria-label="End date"
            />
            {hasDateFilter && (
              <Button variant="ghost" size="sm" onClick={clearDateFilter} className="h-9 px-2 text-xs text-muted-foreground">
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            )}
          </div>

          {dateRangeInvalid && (
            <p className="text-xs text-destructive">Start date must be before the end date.</p>
          )}
        </CardHeader>

        <CardContent className="p-0">
          <BulkActionsBar
            count={selected.size}
            onDelete={() => setBulkConfirmOpen(true)}
            onClear={() => setSelected(new Set())}
            isDeleting={isBulkDeleting}
            label="transaction"
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={allSelectedOnPage}
                      indeterminate={someSelectedOnPage && !allSelectedOnPage}
                      onChange={toggleSelectAll}
                      aria-label="Select all transactions on this page"
                    />
                  </TableHead>
                  <SortableTableHead sortKey="date" sort={sort} onSort={toggleSort} className="text-muted-foreground font-medium py-4">Date</SortableTableHead>
                  <SortableTableHead sortKey="entity" sort={sort} onSort={toggleSort} className="text-muted-foreground font-medium py-4">Entity</SortableTableHead>
                  <TableHead className="text-muted-foreground font-medium py-4">Description</TableHead>
                  <SortableTableHead sortKey="category" sort={sort} onSort={toggleSort} className="text-muted-foreground font-medium py-4">Category</SortableTableHead>
                  <SortableTableHead sortKey="amount" sort={sort} onSort={toggleSort} className="text-muted-foreground font-medium py-4 text-right pr-6">Amount</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">Loading transactions...</p>
                    </TableCell>
                  </TableRow>
                ) : dateRangeInvalid || transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <p className="text-sm text-muted-foreground">
                        {dateRangeInvalid
                          ? "Fix the date range above to see results."
                          : "No transactions found matching your criteria."}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => {
                    const isIncome = tx.type === "INCOME";
                    const key = txKey(tx);
                    return (
                      <TableRow key={key} className="transition-colors" data-state={selected.has(key) ? "selected" : undefined}>
                        <TableCell className="pl-6">
                          <Checkbox
                            checked={selected.has(key)}
                            onChange={() => toggleSelect(key)}
                            aria-label={`Select ${tx.entity || "transaction"}`}
                          />
                        </TableCell>
                        <TableCell className="text-foreground whitespace-nowrap">
                          {format(new Date(tx.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{tx.entity}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">{tx.description}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono font-medium">
                            {tx.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap pr-6">
                          <div
                            className={`font-mono font-semibold flex items-center justify-end gap-1 ${
                              isIncome ? "text-primary" : "text-destructive"
                            }`}
                          >
                            {isIncome ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                            {isIncome ? "+" : "-"} {tx.currency}{" "}
                            {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} isFetching={isFetching} />
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selected.size} Transaction(s)?`}
        description="Each selected row is removed from its underlying income or expense log. This cannot be undone."
        confirmText="Delete Selected"
        isLoading={isBulkDeleting}
      />
    </div>
  );
}

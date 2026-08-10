"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Search, Loader2, ArrowUpRight, ArrowDownRight, X } from "lucide-react";
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
import { Toast } from "@/components/ui/toast";
import { useTransactions, TransactionType, UnifiedTransaction } from "@/hooks/use-transactions";
import { useDeleteIncome } from "@/hooks/use-income";
import { useDeleteExpense } from "@/hooks/use-expenses";

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
  const [toast, setToast] = useState<{ type: "error" | "success"; title?: string; message: string } | null>(null);

  const deleteIncomeMutation = useDeleteIncome();
  const deleteExpenseMutation = useDeleteExpense();

  // Any filter change invalidates the current page — starting over on page 1
  // avoids landing on a now-empty page (e.g. filtering to a date range with fewer rows).
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, startDate, endDate]);

  const { data, isLoading, isFetching } = useTransactions({
    search,
    type: typeFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const total = data?.total ?? 0;
  const hasDateFilter = !!(startDate || endDate);
  const dateRangeInvalid = !!(startDate && endDate && startDate > endDate);

  // Sorting only reorders the current page — the data itself is paginated server-side.
  const transactions = useMemo(() => {
    const rows = data?.data ?? [];
    if (!sort) return rows;
    const accessors: Record<string, (tx: UnifiedTransaction) => string | number> = {
      date: (tx) => tx.date,
      entity: (tx) => (tx.entity || "").toLowerCase(),
      category: (tx) => (tx.category || "").toLowerCase(),
      amount: (tx) => Number(tx.amount || 0),
    };
    const accessor = accessors[sort.key];
    if (!accessor) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.direction === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, sort]);

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
    setToast(
      failed === 0
        ? { type: "success", title: "Transactions Deleted", message: `${deleted} transaction(s) removed.` }
        : { type: "error", title: "Some Deletes Failed", message: `${deleted} deleted, ${failed} failed.` }
    );
  };

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Unified Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track all your business income and expenses chronologically in one place.
          </p>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Type Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-card border border-border rounded-xl overflow-x-auto shadow-sm">
          {[
            { label: "All Types", value: "ALL" },
            { label: "Income Only", value: "INCOME" },
            { label: "Expenses Only", value: "EXPENSE" },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setTypeFilter(item.value as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all whitespace-nowrap ${
                typeFilter === item.value
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Date Range & Search Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border p-1 rounded-xl shadow-sm">
            <span className="px-2 font-medium">Date:</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[130px] h-8 bg-background border-border text-foreground text-xs"
              aria-label="Start date"
            />
            <span>to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[130px] h-8 bg-background border-border text-foreground text-xs"
              aria-label="End date"
            />
            {hasDateFilter && (
              <Button variant="ghost" size="sm" onClick={clearDateFilter} className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            )}
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search entity, description..."
              className="pl-9 bg-background border-border text-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {dateRangeInvalid && (
        <p className="text-xs text-destructive">Start date must be before the end date.</p>
      )}

      {/* Table Container matching Income, Expenses, Clients & Invoices */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <BulkActionsBar
          count={selected.size}
          onDelete={() => setBulkConfirmOpen(true)}
          onClear={() => setSelected(new Set())}
          isDeleting={isBulkDeleting}
          label="transaction"
        />
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelectedOnPage}
                  indeterminate={someSelectedOnPage && !allSelectedOnPage}
                  onChange={toggleSelectAll}
                  aria-label="Select all transactions on this page"
                />
              </TableHead>
              <SortableTableHead sortKey="date" sort={sort} onSort={toggleSort} className="text-muted-foreground font-medium">Date</SortableTableHead>
              <SortableTableHead sortKey="entity" sort={sort} onSort={toggleSort} className="text-muted-foreground font-medium">Entity</SortableTableHead>
              <TableHead className="text-muted-foreground font-medium">Description</TableHead>
              <SortableTableHead sortKey="category" sort={sort} onSort={toggleSort} className="text-muted-foreground font-medium">Category</SortableTableHead>
              <SortableTableHead sortKey="amount" sort={sort} onSort={toggleSort} className="text-muted-foreground font-medium text-right">Amount</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">Loading transactions...</p>
                </TableCell>
              </TableRow>
            ) : dateRangeInvalid || transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
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
                    <TableCell>
                      <Checkbox
                        checked={selected.has(key)}
                        onChange={() => toggleSelect(key)}
                        aria-label={`Select ${tx.entity || "transaction"}`}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                      {format(new Date(tx.date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">{tx.entity}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[250px] truncate">{tx.description}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize font-medium">
                        {tx.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap font-mono">
                      <div
                        className={`font-bold flex items-center justify-end gap-1 ${
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
        <PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} isFetching={isFetching} />
      </div>

      <ConfirmModal
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selected.size} Transaction(s)?`}
        description="Each selected row is removed from its underlying income or expense log. This cannot be undone."
        confirmText="Delete Selected"
        isLoading={isBulkDeleting}
      />

      {toast && (
        <Toast type={toast.type} title={toast.title} message={toast.message} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

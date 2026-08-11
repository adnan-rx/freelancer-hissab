"use client";

import { useState } from 'react';
import { Paperclip, Pencil, Plus, Trash2, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { BulkActionsBar } from '@/components/ui/bulk-actions-bar';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { DataToolbar, ToolbarFilter } from '@/components/ui/data-toolbar';
import { formatPKR, formatDate, apiErrorMessage } from '@/lib/utils';
import { useExpenses, useDeleteExpense, EXPENSE_CATEGORIES } from '@/hooks/use-expenses';
import { useDataTable } from '@/hooks/use-data-table';
import { AddExpenseModal } from '@/components/features/add-expense-modal';
import { EvidenceVaultModal } from '@/components/features/evidence-vault-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useToast } from '@/providers/toast-provider';

export default function ExpensesPage() {
  const { data: expensesList = [], isLoading, isError, error } = useExpenses();
  const deleteExpenseMutation = useDeleteExpense();
  const { showSuccess, showError } = useToast();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const displayExpenses = expensesList.filter((exp: any) => {
    if (categoryFilter === "all") return true;
    return (exp.category || "other") === categoryFilter;
  });

  const table = useDataTable(displayExpenses, {
    getId: (exp: any) => exp.id,
    sortAccessors: {
      date: (exp: any) => exp.expenseDate || "",
      description: (exp: any) => (exp.description || "").toLowerCase(),
      category: (exp: any) => (exp.category || "").toLowerCase(),
      amount: (exp: any) => Number(exp.amountPKR ?? exp.amount ?? 0),
    },
  });

  const totalPKR = displayExpenses.reduce((sum: number, exp: any) => sum + Number(exp.amountPKR ?? exp.amount ?? 0), 0);
  const largestCategory = Object.entries(
    displayExpenses.reduce((acc: Record<string, number>, exp: any) => {
      const key = exp.category || "other";
      acc[key] = (acc[key] || 0) + Number(exp.amountPKR ?? exp.amount ?? 0);
      return acc;
    }, {})
  ).sort((a, b) => (b[1] as number) - (a[1] as number))[0];

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExpenseMutation.mutateAsync(deleteTarget.id);
      showSuccess("The expense has been removed.", "Expense deleted");
    } catch (err) {
      showError(apiErrorMessage(err), "Couldn't delete expense");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(table.selected);
    setIsBulkDeleting(true);
    const results = await Promise.allSettled(ids.map((id) => deleteExpenseMutation.mutateAsync(id)));
    setIsBulkDeleting(false);
    setBulkConfirmOpen(false);
    table.clearSelection();

    const failed = results.filter((r) => r.status === "rejected").length;
    const deleted = ids.length - failed;
    if (failed === 0) {
      showSuccess(`${deleted} expense${deleted === 1 ? "" : "s"} removed.`, "Expenses deleted");
    } else {
      showError(`${deleted} deleted, ${failed} could not be removed.`, "Some deletes failed");
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="Expenses"
        description="Internet, software, hardware and subscriptions — the costs that reduce your taxable income."
        actions={
          <Button
            onClick={() => {
              setEditingExpense(null);
              setIsAddOpen(true);
            }}
          >
            <Plus /> Add expense
          </Button>
        }
      />

      {isError ? (
        <Card>
          <ErrorState description={apiErrorMessage(error, "Could not load your expenses.")} />
        </Card>
      ) : (
        <>
          <section aria-label="Expense totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Total expenses"
              value={formatPKR(totalPKR)}
              icon={Wallet}
              emphasis
              hint={categoryFilter === "all" ? "All categories" : "Current category only"}
              isLoading={isLoading}
            />
            <StatCard
              label="Entries"
              value={displayExpenses.length}
              unit={displayExpenses.length === 1 ? "record" : "records"}
              icon={Wallet}
              hint="Matching the current filter"
              isLoading={isLoading}
            />
            <StatCard
              label="Largest category"
              value={largestCategory ? formatPKR(largestCategory[1] as number) : formatPKR(0)}
              icon={Wallet}
              hint={
                largestCategory
                  ? (EXPENSE_CATEGORIES.find((c) => c.value === largestCategory[0])?.label ?? largestCategory[0])
                  : "Nothing logged yet"
              }
              isLoading={isLoading}
            />
          </section>

          <Card className="overflow-hidden">
            {table.selected.size > 0 ? (
              <BulkActionsBar
                count={table.selected.size}
                onDelete={() => setBulkConfirmOpen(true)}
                onClear={table.clearSelection}
                isDeleting={isBulkDeleting}
                label="expense"
              />
            ) : (
              <DataToolbar>
                <ToolbarFilter label="Category">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[13rem]">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ToolbarFilter>
              </DataToolbar>
            )}

            {isLoading ? (
              <TableSkeleton rows={6} columns={6} />
            ) : displayExpenses.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title={expensesList.length === 0 ? "No expenses recorded yet" : "Nothing in this category"}
                description={
                  expensesList.length === 0
                    ? "Log internet, software and equipment costs and they'll be deducted in your tax estimate."
                    : "Switch back to all categories to see every expense."
                }
                action={
                  expensesList.length === 0 ? (
                    <Button
                      onClick={() => {
                        setEditingExpense(null);
                        setIsAddOpen(true);
                      }}
                    >
                      <Plus /> Add your first expense
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setCategoryFilter("all")}>
                      Show all categories
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <Table className="min-w-[50rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Checkbox
                          checked={table.allSelectedOnPage}
                          indeterminate={table.someSelectedOnPage && !table.allSelectedOnPage}
                          onChange={table.toggleSelectAll}
                          aria-label="Select all expenses on this page"
                        />
                      </TableHead>
                      <SortableTableHead sortKey="date" sort={table.sort} onSort={table.toggleSort}>
                        Date
                      </SortableTableHead>
                      <SortableTableHead sortKey="description" sort={table.sort} onSort={table.toggleSort}>
                        Description
                      </SortableTableHead>
                      <SortableTableHead sortKey="category" sort={table.sort} onSort={table.toggleSort}>
                        Category
                      </SortableTableHead>
                      <TableHead>Paid via</TableHead>
                      <SortableTableHead sortKey="amount" sort={table.sort} onSort={table.toggleSort} align="right">
                        Amount
                      </SortableTableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {table.paged.map((exp: any) => {
                      const amountPKR = Number(exp.amountPKR ?? exp.amount ?? 0);
                      const isForeign = exp.currency && exp.currency !== "PKR";
                      return (
                        <TableRow key={exp.id} data-state={table.selected.has(exp.id) ? "selected" : undefined}>
                          <TableCell>
                            <Checkbox
                              checked={table.selected.has(exp.id)}
                              onChange={() => table.toggleSelect(exp.id)}
                              aria-label={`Select ${exp.description || "expense"}`}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground tabular">
                            {exp.expenseDate ? formatDate(String(exp.expenseDate).substring(0, 10)) : "—"}
                          </TableCell>
                          <TableCell>
                            <span className="block font-medium text-foreground">{exp.description}</span>
                            {exp.vendor && <span className="block text-xs text-muted-foreground">{exp.vendor}</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="neutral" className="capitalize">
                              {EXPENSE_CATEGORIES.find((c) => c.value === exp.category)?.label ?? exp.category ?? "other"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs capitalize text-muted-foreground">
                            {(exp.paymentMethod || "bank_transfer").replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="block font-mono text-sm font-medium tabular-nums text-foreground">
                              {formatPKR(amountPKR)}
                            </span>
                            {isForeign && (
                              <span className="block font-mono text-xs tabular-nums text-muted-foreground">
                                {exp.currency} {Number(exp.amount).toFixed(2)} @ {Number(exp.exchangeRate).toFixed(2)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="flex items-center justify-end gap-0.5">
                              <Button
                                onClick={() => setEvidenceTarget({ id: exp.id, title: exp.description || "Expense" })}
                                size="icon-sm"
                                variant="ghost"
                                title="Evidence and receipts"
                              >
                                <Paperclip />
                                <span className="sr-only">Evidence for {exp.description || "this expense"}</span>
                              </Button>
                              <Button
                                onClick={() => {
                                  setEditingExpense(exp);
                                  setIsAddOpen(true);
                                }}
                                size="icon-sm"
                                variant="ghost"
                                title="Edit expense"
                              >
                                <Pencil />
                                <span className="sr-only">Edit {exp.description || "this expense"}</span>
                              </Button>
                              <Button
                                onClick={() => setDeleteTarget({ id: exp.id, description: exp.description || "Expense" })}
                                size="icon-sm"
                                variant="ghost"
                                className="hover:bg-destructive-surface hover:text-destructive"
                                title="Delete expense"
                              >
                                <Trash2 />
                                <span className="sr-only">Delete {exp.description || "this expense"}</span>
                              </Button>
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm font-medium text-foreground">
                        Total · {displayExpenses.length} {displayExpenses.length === 1 ? "entry" : "entries"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold tabular-nums text-foreground">
                        {formatPKR(totalPKR)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
                <PaginationBar
                  page={table.page}
                  pageSize={table.pageSize}
                  total={table.total}
                  onPageChange={table.setPage}
                  onPageSizeChange={table.setPageSize}
                />
              </>
            )}
          </Card>
        </>
      )}

      <AddExpenseModal
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          setEditingExpense(null);
        }}
        expense={editingExpense}
      />

      <EvidenceVaultModal
        isOpen={!!evidenceTarget}
        onClose={() => setEvidenceTarget(null)}
        recordId={evidenceTarget?.id || null}
        recordType="expense"
        recordTitle={evidenceTarget?.title}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete this expense?"
        description={deleteTarget ? `"${deleteTarget.description}" will be removed. This cannot be undone.` : ""}
        confirmText="Delete expense"
        isLoading={deleteExpenseMutation.isPending}
      />

      <ConfirmModal
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${table.selected.size} expense${table.selected.size === 1 ? "" : "s"}?`}
        description="This cannot be undone."
        confirmText="Delete selected"
        isLoading={isBulkDeleting}
      />
    </div>
  );
}

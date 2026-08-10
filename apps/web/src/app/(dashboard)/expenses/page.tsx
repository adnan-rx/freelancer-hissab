"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { BulkActionsBar } from '@/components/ui/bulk-actions-bar';
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react';
import { formatPKR, apiErrorMessage } from '@/lib/utils';
import { useExpenses, useDeleteExpense, EXPENSE_CATEGORIES } from '@/hooks/use-expenses';
import { useDataTable } from '@/hooks/use-data-table';
import { AddExpenseModal } from '@/components/features/add-expense-modal';
import { EvidenceVaultModal } from '@/components/features/evidence-vault-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Toast } from '@/components/ui/toast';

const PAGE_SIZE = 10;

export default function ExpensesPage() {
  const { data: expensesList = [], isLoading, isError, error } = useExpenses();
  const deleteExpenseMutation = useDeleteExpense();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'error' | 'success'; title?: string; message: string } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const displayExpenses = expensesList.filter((exp: any) => {
    if (categoryFilter === "all") return true;
    return (exp.category || "other") === categoryFilter;
  });

  const table = useDataTable(displayExpenses, {
    getId: (exp: any) => exp.id,
    pageSize: PAGE_SIZE,
    sortAccessors: {
      date: (exp: any) => exp.expenseDate || "",
      description: (exp: any) => (exp.description || "").toLowerCase(),
      category: (exp: any) => (exp.category || "").toLowerCase(),
      amount: (exp: any) => Number(exp.amountPKR ?? exp.amount ?? 0),
    },
  });

  const totalPKR = displayExpenses.reduce((sum: number, exp: any) => sum + Number(exp.amountPKR ?? exp.amount ?? 0), 0);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExpenseMutation.mutateAsync(deleteTarget.id);
      setToast({ type: "success", title: "Expense Deleted", message: "The expense has been removed." });
    } catch (err) {
      setToast({ type: "error", title: "Delete Failed", message: apiErrorMessage(err) });
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
    setToast(
      failed === 0
        ? { type: "success", title: "Expenses Deleted", message: `${deleted} expense(s) removed.` }
        : { type: "error", title: "Some Deletes Failed", message: `${deleted} deleted, ${failed} failed.` }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">Track business expenses, internet bills, hardware, and subscriptions.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditingExpense(null); setIsAddOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Expense
          </Button>
        </div>
      </div>

      {isError && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {apiErrorMessage(error, "Could not load your expenses.")}
        </div>
      )}

      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <BulkActionsBar
          count={table.selected.size}
          onDelete={() => setBulkConfirmOpen(true)}
          onClear={table.clearSelection}
          isDeleting={isBulkDeleting}
          label="expense"
        />
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="w-10">
                <Checkbox
                  checked={table.allSelectedOnPage}
                  indeterminate={table.someSelectedOnPage && !table.allSelectedOnPage}
                  onChange={table.toggleSelectAll}
                  aria-label="Select all expenses on this page"
                />
              </TableHead>
              <SortableTableHead sortKey="date" sort={table.sort} onSort={table.toggleSort} className="text-muted-foreground font-medium">Date</SortableTableHead>
              <SortableTableHead sortKey="description" sort={table.sort} onSort={table.toggleSort} className="text-muted-foreground font-medium">Description / Vendor</SortableTableHead>
              <SortableTableHead sortKey="category" sort={table.sort} onSort={table.toggleSort} className="text-muted-foreground font-medium">Category</SortableTableHead>
              <TableHead className="text-muted-foreground font-medium">Payment Method</TableHead>
              <SortableTableHead sortKey="amount" sort={table.sort} onSort={table.toggleSort} className="text-muted-foreground font-medium text-right">Amount (PKR)</SortableTableHead>
              <TableHead className="text-muted-foreground font-medium text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading expenses...</TableCell>
              </TableRow>
            ) : displayExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Wallet className="h-8 w-8 text-muted-foreground/60" />
                    <p className="font-semibold text-foreground">
                      {expensesList.length === 0 ? "No expenses recorded yet" : "No expenses in this category"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {expensesList.length === 0
                        ? "Log your internet, software and equipment costs to reduce taxable local income."
                        : "Try a different category filter."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.paged.map((exp: any) => {
                const amountPKR = Number(exp.amountPKR ?? exp.amount ?? 0);
                const isForeign = exp.currency && exp.currency !== "PKR";
                return (
                  <TableRow key={exp.id} className="transition-colors" data-state={table.selected.has(exp.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={table.selected.has(exp.id)}
                        onChange={() => table.toggleSelect(exp.id)}
                        aria-label={`Select ${exp.description || "expense"}`}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {exp.expenseDate ? String(exp.expenseDate).substring(0, 10) : "—"}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {exp.description} {exp.vendor ? <span className="text-xs text-muted-foreground ml-1">({exp.vendor})</span> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {exp.category || "other"}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground text-xs">
                      {(exp.paymentMethod || "bank_transfer").replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-bold text-destructive">{formatPKR(amountPKR)}</div>
                      {isForeign && (
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {exp.currency} {Number(exp.amount).toFixed(2)} @ {Number(exp.exchangeRate).toFixed(2)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          onClick={() => setEvidenceTarget({ id: exp.id, title: exp.description || "Expense Entry" })}
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs font-semibold rounded-lg hover:text-primary transition-colors"
                        >
                          Evidence
                        </Button>
                        <Button
                          onClick={() => { setEditingExpense(exp); setIsAddOpen(true); }}
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted"
                          title="Edit Expense"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => setDeleteTarget({ id: exp.id, description: exp.description || "Expense Entry" })}
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-muted"
                          title="Delete Expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
          {displayExpenses.length > 0 && (
            <tfoot className="bg-muted/30 border-t border-border">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-foreground">Total ({displayExpenses.length})</td>
                <td className="px-4 py-3 text-right font-bold text-destructive font-mono">{formatPKR(totalPKR)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </Table>
        <PaginationBar page={table.page} pageSize={PAGE_SIZE} total={table.total} onPageChange={table.setPage} />
      </div>

      <AddExpenseModal
        isOpen={isAddOpen}
        onClose={() => { setIsAddOpen(false); setEditingExpense(null); }}
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
        title="Delete Expense?"
        description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.description}"? This cannot be undone.` : ""}
        confirmText="Delete Expense"
        isLoading={deleteExpenseMutation.isPending}
      />

      <ConfirmModal
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${table.selected.size} Expense(s)?`}
        description="This cannot be undone."
        confirmText="Delete Selected"
        isLoading={isBulkDeleting}
      />

      {toast && (
        <Toast type={toast.type} title={toast.title} message={toast.message} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

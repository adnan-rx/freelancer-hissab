"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react';
import { formatPKR, apiErrorMessage } from '@/lib/utils';
import { useExpenses, useDeleteExpense, EXPENSE_CATEGORIES } from '@/hooks/use-expenses';
import { AddExpenseModal } from '@/components/features/add-expense-modal';
import { EvidenceVaultModal } from '@/components/features/evidence-vault-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Toast } from '@/components/ui/toast';

export default function ExpensesPage() {
  const { data: expensesList = [], isLoading, isError, error } = useExpenses();
  const deleteExpenseMutation = useDeleteExpense();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'error' | 'success'; title?: string; message: string } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const displayExpenses = expensesList.filter((exp: any) => {
    if (categoryFilter === "all") return true;
    return (exp.category || "other") === categoryFilter;
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
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground font-medium">Date</TableHead>
              <TableHead className="text-muted-foreground font-medium">Description / Vendor</TableHead>
              <TableHead className="text-muted-foreground font-medium">Category</TableHead>
              <TableHead className="text-muted-foreground font-medium text-right">Amount (PKR)</TableHead>
              <TableHead className="text-muted-foreground font-medium text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading expenses...</TableCell>
              </TableRow>
            ) : displayExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
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
              displayExpenses.map((exp: any) => {
                const amountPKR = Number(exp.amountPKR ?? exp.amount ?? 0);
                const isForeign = exp.currency && exp.currency !== "PKR";
                return (
                  <TableRow key={exp.id} className="transition-colors">
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
                <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-foreground">Total</td>
                <td className="px-4 py-3 text-right font-bold text-destructive font-mono">{formatPKR(totalPKR)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </Table>
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

      {toast && (
        <Toast type={toast.type} title={toast.title} message={toast.message} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

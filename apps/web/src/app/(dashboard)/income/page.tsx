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
import { Plus, Sparkles, Trash2, DollarSign, Pencil } from 'lucide-react';
import { formatPKR, formatUSD, apiErrorMessage } from '@/lib/utils';
import { useIncome, useDeleteIncome } from '@/hooks/use-income';
import { useDataTable } from '@/hooks/use-data-table';
import { CSVImportModal } from '@/components/features/csv-import-modal';
import { AddIncomeModal } from '@/components/features/add-income-modal';
import { EvidenceVaultModal } from '@/components/features/evidence-vault-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useToast } from '@/providers/toast-provider';

const PAGE_SIZE = 10;

export default function IncomePage() {
  const { data: incomeList = [], isLoading } = useIncome();
  const deleteIncomeMutation = useDeleteIncome();
  const { showSuccess, showError } = useToast();

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<any | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<{ id: string; title: string } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const displayIncome = incomeList.filter((inc: any) => {
    if (sourceFilter === "all") return true;
    const isForeign = !!inc.prcReferenceNumber || (inc.platform && inc.platform !== "direct");
    if (sourceFilter === "foreign") return isForeign;
    if (sourceFilter === "local") return !isForeign;
    return true;
  });

  const table = useDataTable(displayIncome, {
    getId: (inc: any) => inc.id,
    pageSize: PAGE_SIZE,
    sortAccessors: {
      date: (inc: any) => inc.receivedAt || "",
      description: (inc: any) => (inc.description || inc.clientName || "").toLowerCase(),
      platform: (inc: any) => (inc.platform || "").toLowerCase(),
      amount: (inc: any) => Number(inc.amount || 0),
      amountPKR: (inc: any) => Number(inc.amountPKR || 0),
    },
  });

  const handleBulkDelete = async () => {
    const ids = Array.from(table.selected);
    setIsBulkDeleting(true);
    const results = await Promise.allSettled(ids.map((id) => deleteIncomeMutation.mutateAsync(id)));
    setIsBulkDeleting(false);
    setBulkConfirmOpen(false);
    table.clearSelection();

    const failed = results.filter((r) => r.status === "rejected").length;
    const deleted = ids.length - failed;
    if (failed === 0) {
      showSuccess(`${deleted} income entr${deleted === 1 ? "y" : "ies"} removed.`, "Income Deleted");
    } else {
      showError(`${deleted} deleted, ${failed} failed.`, "Some Deletes Failed");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteIncomeMutation.mutateAsync(deleteTarget.id);
      showSuccess("Income log has been removed.", "Income Entry Deleted");
      setDeleteTarget(null);
    } catch (err: any) {
      showError(apiErrorMessage(err, "Could not delete income log."), "Delete Failed");
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Income Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Track foreign remittances and local earnings with automated PKR conversion.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="foreign">Foreign / Remittance</SelectItem>
              <SelectItem value="local">Local Income</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => setIsImportOpen(true)}
            variant="outline" 
          >
            <Sparkles className="mr-2 h-4 w-4 text-primary" /> Auto-Import CSV
          </Button>
          <Button 
            onClick={() => { setEditingIncome(null); setIsAddOpen(true); }}
          >
            <Plus className="mr-2 h-4 w-4" /> Log Income
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <BulkActionsBar
          count={table.selected.size}
          onDelete={() => setBulkConfirmOpen(true)}
          onClear={table.clearSelection}
          isDeleting={isBulkDeleting}
          label="income entry"
        />
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="w-10">
                <Checkbox
                  checked={table.allSelectedOnPage}
                  indeterminate={table.someSelectedOnPage && !table.allSelectedOnPage}
                  onChange={table.toggleSelectAll}
                  aria-label="Select all income entries on this page"
                />
              </TableHead>
              <SortableTableHead sortKey="date" sort={table.sort} onSort={table.toggleSort} className="text-muted-foreground font-medium">Date</SortableTableHead>
              <SortableTableHead sortKey="description" sort={table.sort} onSort={table.toggleSort} className="text-muted-foreground font-medium">Description / Client</SortableTableHead>
              <SortableTableHead sortKey="platform" sort={table.sort} onSort={table.toggleSort} className="text-muted-foreground font-medium">Platform</SortableTableHead>
              <SortableTableHead sortKey="amount" sort={table.sort} onSort={table.toggleSort} className="text-muted-foreground font-medium">Original Amount</SortableTableHead>
              <SortableTableHead sortKey="amountPKR" sort={table.sort} onSort={table.toggleSort} className="text-muted-foreground font-medium">Converted Amount (PKR)</SortableTableHead>
              <TableHead className="text-right text-muted-foreground font-medium">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading income logs...</TableCell>
              </TableRow>
            ) : displayIncome.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <DollarSign className="h-8 w-8 text-muted-foreground/60" />
                    <p className="font-semibold text-foreground">No income entries recorded yet</p>
                    <p className="text-xs text-muted-foreground">Log manual foreign income or upload bank statements to start tracking.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.paged.map((inc: any) => (
                <TableRow key={inc.id} className="transition-colors" data-state={table.selected.has(inc.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={table.selected.has(inc.id)}
                      onChange={() => table.toggleSelect(inc.id)}
                      aria-label={`Select ${inc.description || "income entry"}`}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">{inc.receivedAt ? String(inc.receivedAt).substring(0, 10) : "N/A"}</TableCell>
                  <TableCell className="font-medium text-foreground">{inc.description || inc.clientName || "Direct Transfer"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize border-primary/30 text-primary bg-primary/10 font-medium">
                      {inc.platform || "upwork"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground font-medium font-mono">
                    {inc.currency === "USD" ? formatUSD(inc.amount) : `${inc.currency || 'USD'} ${inc.amount}`}
                  </TableCell>
                  <TableCell className="font-bold text-primary font-mono">{formatPKR(inc.amountPKR || 0)}</TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-1">
                    <Button
                      onClick={() => { setEditingIncome(inc); setIsAddOpen(true); }}
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                      title="Edit Income Entry"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => setEvidenceTarget({ id: inc.id, title: inc.description || "Income Entry" })}
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-semibold rounded-lg hover:text-primary transition-colors"
                    >
                      Evidence
                    </Button>
                    <Button
                      onClick={() => setDeleteTarget({ id: inc.id, description: inc.description || "Income Entry" })}
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                      title="Delete Income Entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <PaginationBar page={table.page} pageSize={PAGE_SIZE} total={table.total} onPageChange={table.setPage} />
      </div>

      <CSVImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
      <AddIncomeModal
        isOpen={isAddOpen}
        onClose={() => { setIsAddOpen(false); setEditingIncome(null); }}
        income={editingIncome}
      />
      
      <EvidenceVaultModal 
        isOpen={!!evidenceTarget} 
        onClose={() => setEvidenceTarget(null)} 
        recordId={evidenceTarget?.id || null} 
        recordType="income"
        recordTitle={evidenceTarget?.title}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Income Record?"
        description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.description}"? This action will remove the record from your income logs.` : ""}
        confirmText="Delete Income"
        isLoading={deleteIncomeMutation.isPending}
      />

      <ConfirmModal
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${table.selected.size} Income Entr${table.selected.size === 1 ? "y" : "ies"}?`}
        description="This cannot be undone."
        confirmText="Delete Selected"
        isLoading={isBulkDeleting}
      />
    </div>
  );
}

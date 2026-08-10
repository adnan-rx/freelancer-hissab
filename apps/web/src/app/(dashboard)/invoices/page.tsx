"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { BulkActionsBar } from '@/components/ui/bulk-actions-bar';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Toast } from '@/components/ui/toast';
import { Plus, Search, Eye, FileText, CheckCircle2, Clock, DollarSign, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { formatPKR, formatUSD, apiErrorMessage } from '@/lib/utils';
import { useInvoices, useDeleteInvoice } from '@/hooks/use-invoices';
import { useDataTable } from '@/hooks/use-data-table';

const PAGE_SIZE = 10;

export default function InvoicesPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { data: invoicesList = [], isLoading } = useInvoices(statusFilter === "all" ? undefined : statusFilter);
  const deleteInvoiceMutation = useDeleteInvoice();

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; invoiceNumber: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'error' | 'success'; title?: string; message: string } | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const rawList = invoicesList;

  const displayInvoices = rawList.filter((inv: any) => {
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const clientName = inv.client?.name || inv.clientName || "";
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || clientName.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const table = useDataTable(displayInvoices, {
    getId: (inv: any) => inv.id,
    pageSize: PAGE_SIZE,
    sortAccessors: {
      invoiceNumber: (inv: any) => inv.invoiceNumber || "",
      client: (inv: any) => (inv.client?.name || inv.clientName || "").toLowerCase(),
      dueDate: (inv: any) => inv.dueDate || "",
      total: (inv: any) => Number(inv.total || 0),
      totalPKR: (inv: any) => Number(inv.totalPKR || 0),
      status: (inv: any) => inv.status || "",
    },
  });

  const totalBilledPKR = rawList.reduce((sum: number, inv: any) => sum + Number(inv.totalPKR || 0), 0);
  const totalPaidPKR = rawList.filter((inv: any) => inv.status === "paid").reduce((sum: number, inv: any) => sum + Number(inv.totalPKR || 0), 0);
  const pendingAmountPKR = totalBilledPKR - totalPaidPKR;

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteInvoiceMutation.mutateAsync(deleteTarget.id);
      setToast({ type: "success", title: "Invoice Deleted", message: `"${deleteTarget.invoiceNumber}" has been removed.` });
    } catch (err) {
      setToast({ type: "error", title: "Delete Failed", message: apiErrorMessage(err) });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(table.selected);
    setIsBulkDeleting(true);
    const results = await Promise.allSettled(ids.map((id) => deleteInvoiceMutation.mutateAsync(id)));
    setIsBulkDeleting(false);
    setBulkConfirmOpen(false);
    table.clearSelection();

    const failed = results.filter((r) => r.status === "rejected").length;
    const deleted = ids.length - failed;
    setToast(
      failed === 0
        ? { type: "success", title: "Invoices Deleted", message: `${deleted} invoice(s) removed.` }
        : { type: "error", title: "Some Deletes Failed", message: `${deleted} deleted, ${failed} failed.` }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate, track, and export professional freelancer invoices.</p>
        </div>
        <Button asChild>
          <Link href="/invoices/new"><Plus className="mr-2 h-4 w-4" /> Create New Invoice</Link>
        </Button>
      </div>

      {/* Metrics Banner */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Total Invoiced (PKR)</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatPKR(totalBilledPKR)}</div>
            <p className="text-xs text-muted-foreground mt-1">Gross Invoiced Revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Collected Remittances</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatPKR(totalPaidPKR)}</div>
            <p className="text-xs text-primary mt-1 font-medium">Paid into Meezan / Bank Account</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Outstanding Balance</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{formatPKR(pendingAmountPKR)}</div>
            <p className="text-xs text-amber-500 mt-1 font-medium">Pending or Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-card border border-border rounded-xl overflow-x-auto shadow-sm">
          {["all", "draft", "sent", "paid", "overdue"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                statusFilter === st 
                  ? "bg-primary text-primary-foreground shadow" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by invoice # or client..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background border-border text-foreground"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <BulkActionsBar
          count={table.selected.size}
          onDelete={() => setBulkConfirmOpen(true)}
          onClear={table.clearSelection}
          isDeleting={isBulkDeleting}
          label="invoice"
        />
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="w-10">
                <Checkbox
                  checked={table.allSelectedOnPage}
                  indeterminate={table.someSelectedOnPage && !table.allSelectedOnPage}
                  onChange={table.toggleSelectAll}
                  aria-label="Select all invoices on this page"
                />
              </TableHead>
              <SortableTableHead sortKey="invoiceNumber" sort={table.sort} onSort={table.toggleSort} className="text-muted-foreground font-medium">Invoice Number</SortableTableHead>
              <SortableTableHead sortKey="client" sort={table.sort} onSort={table.toggleSort} className="text-muted-foreground font-medium">Client</SortableTableHead>
              <SortableTableHead sortKey="dueDate" sort={table.sort} onSort={table.toggleSort} className="text-muted-foreground font-medium">Due Date</SortableTableHead>
              <SortableTableHead sortKey="total" sort={table.sort} onSort={table.toggleSort} className="text-muted-foreground font-medium">Billed Amount</SortableTableHead>
              <SortableTableHead sortKey="totalPKR" sort={table.sort} onSort={table.toggleSort} className="text-muted-foreground font-medium">Converted (PKR)</SortableTableHead>
              <SortableTableHead sortKey="status" sort={table.sort} onSort={table.toggleSort} className="text-muted-foreground font-medium">Status</SortableTableHead>
              <TableHead className="text-right text-muted-foreground font-medium">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading invoices...</TableCell>
              </TableRow>
            ) : displayInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No invoices match your filter criteria.</TableCell>
              </TableRow>
            ) : (
              table.paged.map((inv: any) => (
                <TableRow key={inv.id} className="transition-colors" data-state={table.selected.has(inv.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={table.selected.has(inv.id)}
                      onChange={() => table.toggleSelect(inv.id)}
                      aria-label={`Select ${inv.invoiceNumber}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-primary">
                    <Link href={`/invoices/${inv.id}`} className="hover:underline flex items-center gap-1.5 font-mono">
                      <FileText className="h-4 w-4" /> {inv.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-foreground font-medium">
                    {inv.client?.name || inv.clientName || "Direct Client"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">{inv.dueDate || "—"}</TableCell>
                  <TableCell className="font-medium text-foreground">
                    {inv.currency === "USD" ? formatUSD(inv.total) : `${inv.currency || 'USD'} ${Number(inv.total || 0).toFixed(2)}`}
                  </TableCell>
                  <TableCell className="font-bold text-primary font-mono">
                    {formatPKR(inv.totalPKR || 0)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`capitalize ${
                        inv.status === "paid"
                          ? "border-primary/30 text-primary bg-primary/10"
                          : inv.status === "overdue"
                          ? "border-destructive/30 text-destructive bg-destructive/10"
                          : "border-blue-500/30 text-blue-500 bg-blue-500/10"
                      }`}
                    >
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild size="sm" variant="ghost" className="text-muted-foreground hover:text-primary hover:bg-muted">
                        <Link href={`/invoices/${inv.id}`}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> Export PDF
                        </Link>
                      </Button>
                      <Button
                        onClick={() => setDeleteTarget({ id: inv.id, invoiceNumber: inv.invoiceNumber })}
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-muted"
                        title="Delete Invoice"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <PaginationBar page={table.page} pageSize={PAGE_SIZE} total={table.total} onPageChange={table.setPage} />
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Invoice?"
        description={deleteTarget ? `Delete "${deleteTarget.invoiceNumber}"? This cannot be undone.` : ""}
        confirmText="Delete Invoice"
        isLoading={deleteInvoiceMutation.isPending}
      />

      <ConfirmModal
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${table.selected.size} Invoice(s)?`}
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

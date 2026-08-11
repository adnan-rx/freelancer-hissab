"use client";

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, DollarSign, Eye, FileText, Lock, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { BulkActionsBar } from '@/components/ui/bulk-actions-bar';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { DataToolbar, SearchInput } from '@/components/ui/data-toolbar';
import { SegmentedFilter } from '@/components/ui/segmented-filter';
import { InvoiceStatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/providers/toast-provider';
import { formatPKR, formatMoney, formatDate, apiErrorMessage } from '@/lib/utils';
import { useInvoices, useDeleteInvoice } from '@/hooks/use-invoices';
import { useDataTable } from '@/hooks/use-data-table';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function InvoicesPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { data: invoicesList = [], isLoading } = useInvoices(statusFilter === "all" ? undefined : statusFilter);
  const deleteInvoiceMutation = useDeleteInvoice();
  const { showSuccess, showError } = useToast();

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; invoiceNumber: string } | null>(null);
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
  // Same definition the dashboard uses: sent/viewed/overdue only. This used
  // to be "everything not paid", which counted drafts (never sent to anyone)
  // and cancelled invoices (never going to be paid) as money owed — and
  // disagreed with the dashboard's "Pending Invoices" figure on identical data.
  const PENDING_STATUSES = ["sent", "viewed", "overdue"];
  const pendingAmountPKR = rawList
    .filter((inv: any) => PENDING_STATUSES.includes(inv.status))
    .reduce((sum: number, inv: any) => sum + Number(inv.totalPKR || 0), 0);

  const hasFilters = !!search || statusFilter !== "all";

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteInvoiceMutation.mutateAsync(deleteTarget.id);
      showSuccess(`"${deleteTarget.invoiceNumber}" has been removed.`, "Invoice deleted");
    } catch (err) {
      showError(apiErrorMessage(err), "Couldn't delete invoice");
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
    if (failed === 0) {
      showSuccess(`${deleted} invoice${deleted === 1 ? "" : "s"} removed.`, "Invoices deleted");
    } else {
      showError(`${deleted} deleted, ${failed} could not be removed.`, "Some deletes failed");
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="Invoices"
        description="Every invoice you've raised, what's been collected, and what's still owed."
        actions={
          <Button asChild>
            <Link href="/invoices/new">
              <Plus /> New invoice
            </Link>
          </Button>
        }
      />

      <section aria-label="Invoice totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total invoiced"
          value={formatPKR(totalBilledPKR)}
          icon={DollarSign}
          hint="Gross across all statuses"
          isLoading={isLoading}
        />
        <StatCard
          label="Collected"
          value={formatPKR(totalPaidPKR)}
          icon={CheckCircle2}
          emphasis
          hint="Marked paid"
          isLoading={isLoading}
        />
        <StatCard
          label="Outstanding"
          value={formatPKR(pendingAmountPKR)}
          icon={Clock}
          hint="Sent, viewed or overdue"
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
            label="invoice"
          />
        ) : (
          <DataToolbar>
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search invoice number or client"
              aria-label="Search invoices"
              className="sm:w-72"
            />
            <SegmentedFilter
              options={STATUS_FILTERS}
              value={statusFilter}
              onChange={setStatusFilter}
              ariaLabel="Filter by status"
            />
          </DataToolbar>
        )}

        {isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : displayInvoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={hasFilters ? "No invoices match those filters" : "No invoices yet"}
            description={
              hasFilters
                ? "Try a different search term, or switch back to all statuses."
                : "Raise your first invoice and it will show up here with its PKR conversion."
            }
            action={
              hasFilters ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/invoices/new">
                    <Plus /> Create an invoice
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <>
            <Table className="min-w-[52rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Checkbox
                      checked={table.allSelectedOnPage}
                      indeterminate={table.someSelectedOnPage && !table.allSelectedOnPage}
                      onChange={table.toggleSelectAll}
                      aria-label="Select all invoices on this page"
                    />
                  </TableHead>
                  <SortableTableHead sortKey="invoiceNumber" sort={table.sort} onSort={table.toggleSort}>
                    Invoice
                  </SortableTableHead>
                  <SortableTableHead sortKey="client" sort={table.sort} onSort={table.toggleSort}>
                    Client
                  </SortableTableHead>
                  <SortableTableHead sortKey="dueDate" sort={table.sort} onSort={table.toggleSort}>
                    Due
                  </SortableTableHead>
                  <SortableTableHead sortKey="total" sort={table.sort} onSort={table.toggleSort} align="right">
                    Billed
                  </SortableTableHead>
                  <SortableTableHead sortKey="totalPKR" sort={table.sort} onSort={table.toggleSort} align="right">
                    In PKR
                  </SortableTableHead>
                  <SortableTableHead sortKey="status" sort={table.sort} onSort={table.toggleSort}>
                    Status
                  </SortableTableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.paged.map((inv: any) => {
                  const canEdit = inv.status !== 'paid' && inv.status !== 'cancelled';
                  return (
                    <TableRow key={inv.id} data-state={table.selected.has(inv.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={table.selected.has(inv.id)}
                          onChange={() => table.toggleSelect(inv.id)}
                          aria-label={`Select ${inv.invoiceNumber}`}
                        />
                      </TableCell>

                      <TableCell>
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="inline-flex items-center gap-2 whitespace-nowrap rounded-sm font-mono text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                        >
                          <FileText className="size-4 shrink-0 text-subtle" aria-hidden="true" />
                          {inv.invoiceNumber}
                        </Link>
                      </TableCell>

                      <TableCell className="font-medium text-foreground">
                        {inv.client?.name || inv.clientName || "Direct client"}
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-muted-foreground tabular">
                        {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                      </TableCell>

                      <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                        {formatMoney(inv.total, inv.currency)}
                      </TableCell>

                      <TableCell className="text-right font-mono text-sm font-medium tabular-nums text-foreground">
                        {formatPKR(inv.totalPKR || 0)}
                      </TableCell>

                      <TableCell>
                        <InvoiceStatusBadge status={inv.status} />
                      </TableCell>

                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-0.5">
                          <Button asChild size="icon-sm" variant="ghost" title={`View ${inv.invoiceNumber}`}>
                            <Link href={`/invoices/${inv.id}`}>
                              <Eye />
                              <span className="sr-only">View {inv.invoiceNumber}</span>
                            </Link>
                          </Button>
                          {canEdit ? (
                            <Button asChild size="icon-sm" variant="ghost" title={`Edit ${inv.invoiceNumber}`}>
                              <Link href={`/invoices/${inv.id}/edit`}>
                                <Pencil />
                                <span className="sr-only">Edit {inv.invoiceNumber}</span>
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              disabled
                              size="icon-sm"
                              variant="ghost"
                              title={
                                inv.status === 'paid'
                                  ? "Paid invoices are locked to keep tax and PRC records intact."
                                  : "Cancelled invoices are archived and cannot be edited."
                              }
                            >
                              <Lock />
                              <span className="sr-only">
                                {inv.invoiceNumber} is locked and cannot be edited
                              </span>
                            </Button>
                          )}
                          <Button
                            onClick={() => setDeleteTarget({ id: inv.id, invoiceNumber: inv.invoiceNumber })}
                            size="icon-sm"
                            variant="ghost"
                            className="hover:bg-destructive-surface hover:text-destructive"
                            title={`Delete ${inv.invoiceNumber}`}
                          >
                            <Trash2 />
                            <span className="sr-only">Delete {inv.invoiceNumber}</span>
                          </Button>
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
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

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete this invoice?"
        description={deleteTarget ? `"${deleteTarget.invoiceNumber}" will be removed. This cannot be undone.` : ""}
        confirmText="Delete invoice"
        isLoading={deleteInvoiceMutation.isPending}
      />

      <ConfirmModal
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${table.selected.size} invoice${table.selected.size === 1 ? "" : "s"}?`}
        description="This cannot be undone."
        confirmText="Delete selected"
        isLoading={isBulkDeleting}
      />
    </div>
  );
}

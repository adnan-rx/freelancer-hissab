"use client";

import { useState } from 'react';
import { ArrowDownRight, DollarSign, Paperclip, Pencil, Plus, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { BulkActionsBar } from '@/components/ui/bulk-actions-bar';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { DataToolbar } from '@/components/ui/data-toolbar';
import { SegmentedFilter } from '@/components/ui/segmented-filter';
import { formatPKR, formatMoney, formatDate, apiErrorMessage } from '@/lib/utils';
import { useIncome, useDeleteIncome } from '@/hooks/use-income';
import { useDataTable } from '@/hooks/use-data-table';
import { CSVImportModal } from '@/components/features/csv-import-modal';
import { AddIncomeModal } from '@/components/features/add-income-modal';
import { EvidenceVaultModal } from '@/components/features/evidence-vault-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useToast } from '@/providers/toast-provider';

const SOURCE_FILTERS = [
  { value: 'all', label: 'All sources' },
  { value: 'foreign', label: 'Foreign' },
  { value: 'local', label: 'Local' },
];

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
    sortAccessors: {
      date: (inc: any) => inc.receivedAt || "",
      description: (inc: any) => (inc.description || inc.clientName || "").toLowerCase(),
      platform: (inc: any) => (inc.platform || "").toLowerCase(),
      amount: (inc: any) => Number(inc.amount || 0),
      amountPKR: (inc: any) => Number(inc.amountPKR || 0),
    },
  });

  const totalPKR = displayIncome.reduce((sum: number, inc: any) => sum + Number(inc.amountPKR || 0), 0);
  const withEvidence = displayIncome.filter((inc: any) => !!inc.prcReferenceNumber).length;

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
      showSuccess(`${deleted} income entr${deleted === 1 ? "y" : "ies"} removed.`, "Income deleted");
    } else {
      showError(`${deleted} deleted, ${failed} could not be removed.`, "Some deletes failed");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteIncomeMutation.mutateAsync(deleteTarget.id);
      showSuccess("The income entry has been removed.", "Income deleted");
      setDeleteTarget(null);
    } catch (err: any) {
      showError(apiErrorMessage(err, "Could not delete this income entry."), "Couldn't delete entry");
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="Income"
        description="Foreign remittances and local earnings, each converted to PKR at the rate on the day it arrived."
        actions={
          <>
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <Upload /> Import CSV
            </Button>
            <Button
              onClick={() => {
                setEditingIncome(null);
                setIsAddOpen(true);
              }}
            >
              <Plus /> Log income
            </Button>
          </>
        }
      />

      <section aria-label="Income totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total income"
          value={formatPKR(totalPKR)}
          icon={ArrowDownRight}
          emphasis
          hint={
            sourceFilter === "all"
              ? "Every entry on record, all years"
              : `${SOURCE_FILTERS.find((f) => f.value === sourceFilter)?.label} only`
          }
          isLoading={isLoading}
        />
        <StatCard
          label="Entries"
          value={displayIncome.length}
          unit={displayIncome.length === 1 ? "record" : "records"}
          icon={DollarSign}
          hint="Matching the current filter"
          isLoading={isLoading}
        />
        <StatCard
          label="With PRC reference"
          value={withEvidence}
          unit={`of ${displayIncome.length}`}
          icon={Paperclip}
          hint="Needed for remittance evidence"
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
            label="income entry"
          />
        ) : (
          <DataToolbar>
            <SegmentedFilter
              options={SOURCE_FILTERS}
              value={sourceFilter}
              onChange={setSourceFilter}
              ariaLabel="Filter by income source"
            />
          </DataToolbar>
        )}

        {isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : displayIncome.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title={sourceFilter === "all" ? "No income recorded yet" : "Nothing matches this filter"}
            description={
              sourceFilter === "all"
                ? "Log a payment manually, or import a bank or platform statement to bring in a whole month at once."
                : "Switch back to all sources to see every entry."
            }
            action={
              sourceFilter === "all" ? (
                <>
                  <Button
                    onClick={() => {
                      setEditingIncome(null);
                      setIsAddOpen(true);
                    }}
                  >
                    <Plus /> Log income
                  </Button>
                  <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                    <Upload /> Import CSV
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setSourceFilter("all")}>
                  Show all sources
                </Button>
              )
            }
          />
        ) : (
          <>
            <Table className="min-w-[48rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Checkbox
                      checked={table.allSelectedOnPage}
                      indeterminate={table.someSelectedOnPage && !table.allSelectedOnPage}
                      onChange={table.toggleSelectAll}
                      aria-label="Select all income entries on this page"
                    />
                  </TableHead>
                  <SortableTableHead sortKey="date" sort={table.sort} onSort={table.toggleSort}>
                    Received
                  </SortableTableHead>
                  <SortableTableHead sortKey="description" sort={table.sort} onSort={table.toggleSort}>
                    Description
                  </SortableTableHead>
                  <SortableTableHead sortKey="platform" sort={table.sort} onSort={table.toggleSort}>
                    Platform
                  </SortableTableHead>
                  <SortableTableHead sortKey="amount" sort={table.sort} onSort={table.toggleSort} align="right">
                    Original
                  </SortableTableHead>
                  <SortableTableHead sortKey="amountPKR" sort={table.sort} onSort={table.toggleSort} align="right">
                    In PKR
                  </SortableTableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.paged.map((inc: any) => (
                  <TableRow key={inc.id} data-state={table.selected.has(inc.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={table.selected.has(inc.id)}
                        onChange={() => table.toggleSelect(inc.id)}
                        aria-label={`Select ${inc.description || "income entry"}`}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular">
                      {inc.receivedAt ? formatDate(String(inc.receivedAt).substring(0, 10)) : "—"}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {inc.description || inc.clientName || "Direct transfer"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral" className="capitalize">
                        {inc.platform || "upwork"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {formatMoney(inc.amount, inc.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium tabular-nums text-foreground">
                      {formatPKR(inc.amountPKR || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="flex items-center justify-end gap-0.5">
                        <Button
                          onClick={() => setEvidenceTarget({ id: inc.id, title: inc.description || "Income entry" })}
                          size="icon-sm"
                          variant="ghost"
                          title="Evidence and attachments"
                        >
                          <Paperclip />
                          <span className="sr-only">Evidence for {inc.description || "this entry"}</span>
                        </Button>
                        <Button
                          onClick={() => {
                            setEditingIncome(inc);
                            setIsAddOpen(true);
                          }}
                          size="icon-sm"
                          variant="ghost"
                          title="Edit entry"
                        >
                          <Pencil />
                          <span className="sr-only">Edit {inc.description || "this entry"}</span>
                        </Button>
                        <Button
                          onClick={() => setDeleteTarget({ id: inc.id, description: inc.description || "Income entry" })}
                          size="icon-sm"
                          variant="ghost"
                          className="hover:bg-destructive-surface hover:text-destructive"
                          title="Delete entry"
                        >
                          <Trash2 />
                          <span className="sr-only">Delete {inc.description || "this entry"}</span>
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
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

      <CSVImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
      <AddIncomeModal
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          setEditingIncome(null);
        }}
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
        title="Delete this income entry?"
        description={deleteTarget ? `"${deleteTarget.description}" will be removed from your income log. This cannot be undone.` : ""}
        confirmText="Delete entry"
        isLoading={deleteIncomeMutation.isPending}
      />

      <ConfirmModal
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${table.selected.size} income entr${table.selected.size === 1 ? "y" : "ies"}?`}
        description="This cannot be undone."
        confirmText="Delete selected"
        isLoading={isBulkDeleting}
      />
    </div>
  );
}

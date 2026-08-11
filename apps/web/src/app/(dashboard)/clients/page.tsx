"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Building, DollarSign, Edit, FilePlus, Loader2, Mail, Phone, Plus, Trash2, Upload, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { BulkActionsBar } from '@/components/ui/bulk-actions-bar';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { DataToolbar, SearchInput } from '@/components/ui/data-toolbar';
import { SegmentedFilter } from '@/components/ui/segmented-filter';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from '@/hooks/use-clients';
import { useDataTable } from '@/hooks/use-data-table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { formatPKR, formatMoney, apiErrorMessage } from '@/lib/utils';
import { CSVImportModal } from '@/components/features/csv-import-modal';
import { useToast } from '@/providers/toast-provider';
import { ConfirmModal } from '@/components/ui/confirm-modal';

const PLATFORMS = [
  { value: 'all', label: 'All' },
  { value: 'upwork', label: 'Upwork' },
  { value: 'fiverr', label: 'Fiverr' },
  { value: 'direct', label: 'Direct' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'other', label: 'Other' },
];

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");

  const { showSuccess, showError } = useToast();
  // `warning` carries the server's "this will also delete N invoices" message on the second (forced) confirm.
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; warning?: string } | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);

  // Form State
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [platform, setPlatform] = useState("upwork");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("active");

  // The request is debounced; the input and client-side filter below stay
  // instant so typing never feels laggy. Previously every keystroke fired
  // its own network request.
  const debouncedSearch = useDebouncedValue(search);
  const { data: clientsList = [], isLoading } = useClients(
    debouncedSearch,
    platformFilter === "all" ? undefined : platformFilter,
  );
  const createClientMutation = useCreateClient();
  const updateClientMutation = useUpdateClient();
  const deleteClientMutation = useDeleteClient();

  const rawList = clientsList;

  // Platform is now filtered server-side (above). This only re-applies the
  // search match client-side, so the list still narrows instantly for the
  // ~300ms the debounced request takes to catch up.
  const displayClients = rawList.filter((client: any) => {
    const clientName = client.name || "";
    const matchesSearch = clientName.toLowerCase().includes(search.toLowerCase()) ||
                          (client.email && client.email.toLowerCase().includes(search.toLowerCase())) ||
                          (client.company && client.company.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  const table = useDataTable(displayClients, {
    getId: (c: any) => c.id,
    sortAccessors: {
      name: (c: any) => (c.name || "").toLowerCase(),
      platform: (c: any) => (c.platform || "").toLowerCase(),
      total: (c: any) => Number(c.totalEarnings || c.totalIncome || 0),
      status: (c: any) => (c.status || "").toLowerCase(),
    },
  });

  const totalClientsCount = rawList.length;
  const activeClientsCount = rawList.filter((c: any) => c.status !== "archived").length;
  const totalLifetimePKR = rawList.reduce((sum: number, c: any) => sum + Number(c.totalEarningsPKR || 0), 0);

  const isSaving = createClientMutation.isPending || updateClientMutation.isPending;
  const hasFilters = !!search || platformFilter !== "all";

  const handleOpenAdd = () => {
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setPlatform("upwork");
    setCurrency("USD");
    setNotes("");
    setStatus("active");
    setEditingClient(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (client: any) => {
    setEditingClient(client);
    setName(client.name || "");
    setCompany(client.company || "");
    setEmail(client.email || "");
    setPhone(client.phone || "");
    setPlatform(client.platform || "direct");
    setCurrency(client.currency || "USD");
    setNotes(client.notes || "");
    setStatus(client.status || "active");
    setIsAddOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name,
      company: company || undefined,
      email: email || undefined,
      phone: phone || undefined,
      platform,
      currency,
      notes: notes || undefined,
      status,
    };

    try {
      if (editingClient) {
        await updateClientMutation.mutateAsync({ id: editingClient.id, ...payload });
        showSuccess(`"${name}" has been updated.`, "Client updated");
      } else {
        await createClientMutation.mutateAsync(payload);
        showSuccess(`"${name}" has been added.`, "Client added");
      }
      setIsAddOpen(false);
    } catch (err: any) {
      showError(apiErrorMessage(err, "Failed to save client profile."), "Couldn't save client");
    }
  };

  // First click: attempt a plain delete. If the client has invoices or income
  // attached, the API refuses and returns what would be affected — show that
  // and ask the user to confirm the destructive version explicitly.
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const alreadyWarned = !!deleteTarget.warning;

    try {
      await deleteClientMutation.mutateAsync({ id: deleteTarget.id, force: alreadyWarned });
      setDeleteTarget(null);
      showSuccess(`"${deleteTarget.name}" has been removed.`, "Client deleted");
    } catch (err: any) {
      const apiErr = err?.response?.data?.error;
      if (apiErr?.details?.requiresForce) {
        setDeleteTarget({ ...deleteTarget, warning: apiErrorMessage(err) });
        return;
      }
      showError(apiErrorMessage(err), "Couldn't delete client");
      setDeleteTarget(null);
    }
  };

  // Bulk delete forces the cascade straight away (unlike the single-row flow's two-step
  // confirm) since the warning below already tells the user upfront what gets removed.
  const handleBulkDelete = async () => {
    const ids = Array.from(table.selected);
    setIsBulkDeleting(true);
    const results = await Promise.allSettled(
      ids.map((id) => deleteClientMutation.mutateAsync({ id, force: true }))
    );
    setIsBulkDeleting(false);
    setBulkConfirmOpen(false);
    table.clearSelection();

    const failed = results.filter((r) => r.status === "rejected").length;
    const deleted = ids.length - failed;
    if (failed === 0) {
      showSuccess(`${deleted} client${deleted === 1 ? "" : "s"} removed.`, "Clients deleted");
    } else {
      showError(`${deleted} deleted, ${failed} could not be removed.`, "Some deletes failed");
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="Clients"
        description="Everyone you bill, the platform they come through, and what they've paid you to date."
        actions={
          <>
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <Upload /> Import CSV
            </Button>
            <Button onClick={handleOpenAdd}>
              <Plus /> Add client
            </Button>
          </>
        }
      />

      <section aria-label="Client totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total clients" value={totalClientsCount} icon={Users} hint="Everyone on record" isLoading={isLoading} />
        <StatCard
          label="Active clients"
          value={activeClientsCount}
          icon={Users}
          hint="Archived clients excluded"
          isLoading={isLoading}
        />
        <StatCard
          label="Lifetime billed"
          value={formatPKR(totalLifetimePKR)}
          icon={DollarSign}
          emphasis
          hint="Converted at each entry's own rate"
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
            label="client"
          />
        ) : (
          <DataToolbar>
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search name, company or email"
              aria-label="Search clients"
              className="sm:w-72"
            />
            <SegmentedFilter
              options={PLATFORMS}
              value={platformFilter}
              onChange={setPlatformFilter}
              ariaLabel="Filter by platform"
            />
          </DataToolbar>
        )}

        {isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : displayClients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasFilters ? "No clients match those filters" : "No clients yet"}
            description={
              hasFilters
                ? "Try a different search term, or clear the platform filter."
                : "Add the people and companies you invoice, then bill them in a couple of clicks."
            }
            action={
              hasFilters ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setPlatformFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button onClick={handleOpenAdd}>
                  <Plus /> Add your first client
                </Button>
              )
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Checkbox
                      checked={table.allSelectedOnPage}
                      indeterminate={table.someSelectedOnPage && !table.allSelectedOnPage}
                      onChange={table.toggleSelectAll}
                      aria-label="Select all clients on this page"
                    />
                  </TableHead>
                  <SortableTableHead sortKey="name" sort={table.sort} onSort={table.toggleSort}>
                    Client
                  </SortableTableHead>
                  <SortableTableHead sortKey="platform" sort={table.sort} onSort={table.toggleSort}>
                    Platform
                  </SortableTableHead>
                  <TableHead>Contact</TableHead>
                  <SortableTableHead sortKey="total" sort={table.sort} onSort={table.toggleSort} align="right">
                    Total billed
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
                {table.paged.map((client: any) => {
                  // This client's own billed total, in their own billing
                  // currency — formatting it as USD regardless of that currency
                  // used to mislabel EUR/GBP clients' totals with a "$" sign.
                  const lifetimeNative = Number(client.totalEarnings || client.totalIncome || 0);
                  const lifetimePKR = Number(client.totalEarningsPKR || 0);
                  const isArchived = client.status === "archived";
                  return (
                    <TableRow key={client.id} data-state={table.selected.has(client.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={table.selected.has(client.id)}
                          onChange={() => table.toggleSelect(client.id)}
                          aria-label={`Select ${client.name}`}
                        />
                      </TableCell>

                      <TableCell>
                        <span className="block font-medium text-foreground">{client.name}</span>
                        {client.company && (
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building className="size-3 shrink-0" aria-hidden="true" /> {client.company}
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge variant="neutral" className="capitalize">
                          {client.platform || "direct"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <span className="flex items-center gap-1.5 text-xs text-foreground">
                          <Mail className="size-3 shrink-0 text-subtle" aria-hidden="true" />
                          {client.email || <span className="text-subtle">No email</span>}
                        </span>
                        {client.phone && (
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="size-3 shrink-0 text-subtle" aria-hidden="true" /> {client.phone}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <span className="block font-mono text-sm font-medium tabular-nums text-foreground">
                          {formatMoney(lifetimeNative, client.currency)}
                        </span>
                        <span className="block font-mono text-xs tabular-nums text-muted-foreground">
                          {formatPKR(lifetimePKR)}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge variant={isArchived ? "neutral" : "success"} dot className="capitalize">
                          {client.status || "active"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-0.5">
                          <Button
                            asChild
                            size="icon-sm"
                            variant="ghost"
                            title={`Create an invoice for ${client.name}`}
                          >
                            <Link href={`/invoices/new?client=${client.id}`}>
                              <FilePlus />
                              <span className="sr-only">Create invoice for {client.name}</span>
                            </Link>
                          </Button>
                          <Button
                            onClick={() => handleOpenEdit(client)}
                            size="icon-sm"
                            variant="ghost"
                            title={`Edit ${client.name}`}
                          >
                            <Edit />
                            <span className="sr-only">Edit {client.name}</span>
                          </Button>
                          <Button
                            onClick={() => setDeleteTarget({ id: client.id, name: client.name })}
                            size="icon-sm"
                            variant="ghost"
                            className="hover:bg-destructive-surface hover:text-destructive"
                            title={`Delete ${client.name}`}
                          >
                            <Trash2 />
                            <span className="sr-only">Delete {client.name}</span>
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

      {/* Add / edit client */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Edit client" : "Add client"}</DialogTitle>
            <DialogDescription>
              {editingClient
                ? "Update contact details, platform or billing currency."
                : "Only a name is required — you can fill in the rest later."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="contents">
            <DialogBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Contact name" htmlFor="client-name" required>
                  <Input
                    id="client-name"
                    placeholder="Ayesha Tariq"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>

                <Field label="Company" htmlFor="client-company">
                  <Input
                    id="client-company"
                    placeholder="Northwind Studio"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" htmlFor="client-email">
                  <Input
                    id="client-email"
                    type="email"
                    placeholder="billing@northwind.co"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>

                <Field label="Phone" htmlFor="client-phone">
                  <Input
                    id="client-phone"
                    placeholder="+1 415 555 0199"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Platform" htmlFor="client-platform">
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger id="client-platform">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upwork">Upwork escrow</SelectItem>
                      <SelectItem value="fiverr">Fiverr orders</SelectItem>
                      <SelectItem value="direct">Direct (bank / Wise)</SelectItem>
                      <SelectItem value="freelancer">Freelancer.com</SelectItem>
                      <SelectItem value="other">Other platform</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Billing currency" htmlFor="client-currency">
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="client-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="PKR">PKR (Rs)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Status" htmlFor="client-status" hint="Archived clients stay on record but drop out of active counts.">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="client-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Notes" htmlFor="client-notes">
                <Textarea
                  id="client-notes"
                  placeholder="Pays via Wise on the 1st of each month."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </Field>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="animate-spin" />}
                {editingClient ? "Save changes" : "Add client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CSVImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={deleteTarget?.warning ? "This deletes related records too" : "Delete this client?"}
        description={
          deleteTarget?.warning
            ? deleteTarget.warning
            : deleteTarget
              ? `"${deleteTarget.name}" will be removed. This cannot be undone.`
              : ""
        }
        confirmText={deleteTarget?.warning ? "Delete anyway" : "Delete client"}
        isLoading={deleteClientMutation.isPending}
      />

      <ConfirmModal
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${table.selected.size} client${table.selected.size === 1 ? "" : "s"}?`}
        description="Any invoices or income records linked to these clients are permanently deleted too. This cannot be undone."
        confirmText="Delete selected"
        isLoading={isBulkDeleting}
      />
    </div>
  );
}

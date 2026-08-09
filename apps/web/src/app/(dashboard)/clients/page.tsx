"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Plus, Users, DollarSign, Building, Mail, Phone, Edit, Trash2, FilePlus, X, Check, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from '@/hooks/use-clients';
import { formatPKR, formatUSD, apiErrorMessage } from '@/lib/utils';
import { CSVImportModal } from '@/components/features/csv-import-modal';
import { Toast } from '@/components/ui/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");

  // Toast & Confirm Modal States
  const [toast, setToast] = useState<{ type: 'error' | 'success'; title?: string; message: string } | null>(null);
  // `warning` carries the server's "this will also delete N invoices" message on the second (forced) confirm.
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; warning?: string } | null>(null);

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

  const { data: clientsList = [], isLoading } = useClients(search);
  const createClientMutation = useCreateClient();
  const updateClientMutation = useUpdateClient();
  const deleteClientMutation = useDeleteClient();

  const rawList = clientsList;

  const displayClients = rawList.filter((client: any) => {
    const matchesPlatform = platformFilter === "all" || client.platform === platformFilter;
    const clientName = client.name || "";
    const matchesSearch = clientName.toLowerCase().includes(search.toLowerCase()) || 
                          (client.email && client.email.toLowerCase().includes(search.toLowerCase())) ||
                          (client.company && client.company.toLowerCase().includes(search.toLowerCase()));
    return matchesPlatform && matchesSearch;
  });

  const totalClientsCount = rawList.length;
  const totalLifetimeUSD = rawList.reduce((sum: number, c: any) => sum + Number(c.totalEarnings || c.totalIncome || 0), 0);
  const totalLifetimePKR = rawList.reduce((sum: number, c: any) => sum + Number(c.totalEarningsPKR || (Number(c.totalEarnings || 0) * 280.50)), 0);

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
    setToast(null);
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
      } else {
        await createClientMutation.mutateAsync(payload);
      }
      setIsAddOpen(false);
    } catch (err: any) {
      setToast({
        type: "error",
        title: "Client Save Failed",
        message: apiErrorMessage(err, "Failed to save client profile."),
      });
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
      setToast({ type: "success", title: "Client Deleted", message: `"${deleteTarget.name}" has been removed.` });
    } catch (err: any) {
      const apiErr = err?.response?.data?.error;
      if (apiErr?.details?.requiresForce) {
        setDeleteTarget({ ...deleteTarget, warning: apiErrorMessage(err) });
        return;
      }
      setToast({ type: "error", title: "Delete Client Failed", message: apiErrorMessage(err) });
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Clients Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your international and local client roster, platforms, and contact details.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setIsImportOpen(true)}
            variant="outline" 
          >
            <Sparkles className="mr-2 h-4 w-4 text-primary" /> Auto-Import Clients via CSV
          </Button>
          <Button onClick={handleOpenAdd}>
            <Plus className="mr-2 h-4 w-4" /> Add New Client
          </Button>
        </div>
      </div>

      {/* KPI Cards Banner */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalClientsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered Client Accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Lifetime Revenue (USD)</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatUSD(totalLifetimeUSD)}</div>
            <p className="text-xs text-primary mt-1 font-medium">Billed across all portals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Converted Lifetime Earnings (PKR)</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatPKR(totalLifetimePKR)}</div>
            <p className="text-xs text-primary mt-1 font-medium">Auto-converted at ~280.50 PKR</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Platform Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-card border border-border rounded-xl overflow-x-auto shadow-sm">
          {["all", "upwork", "fiverr", "direct", "freelancer", "other"].map((pl) => (
            <button
              key={pl}
              onClick={() => setPlatformFilter(pl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                platformFilter === pl 
                  ? "bg-primary text-primary-foreground shadow" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {pl}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search clients by name, company, email..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background border-border text-foreground"
          />
        </div>
      </div>

      {/* Clients Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground font-medium">Client / Company Name</TableHead>
              <TableHead className="text-muted-foreground font-medium">Platform</TableHead>
              <TableHead className="text-muted-foreground font-medium">Email & Contact</TableHead>
              <TableHead className="text-muted-foreground font-medium">Total Billed</TableHead>
              <TableHead className="text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading client directory...</TableCell>
              </TableRow>
            ) : displayClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No clients found matching your search.</TableCell>
              </TableRow>
            ) : (
              displayClients.map((client: any) => {
                const lifetimeUSD = Number(client.totalEarnings || client.totalIncome || 0);
                const lifetimePKR = Number(client.totalEarningsPKR || (lifetimeUSD * 280.50));
                return (
                  <TableRow key={client.id} className="transition-colors">
                    <TableCell>
                      <div className="font-semibold text-foreground">{client.name}</div>
                      {client.company && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Building className="h-3 w-3" /> {client.company}</div>}
                    </TableCell>

                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className="capitalize font-medium"
                      >
                        {client.platform || "direct"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs space-y-0.5">
                      <div className="text-foreground flex items-center gap-1.5"><Mail className="h-3 w-3 text-muted-foreground" /> {client.email || "No email"}</div>
                      {client.phone && <div className="text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" /> {client.phone}</div>}
                    </TableCell>

                    <TableCell className="font-mono">
                      <div className="font-bold text-primary">{formatUSD(lifetimeUSD)}</div>
                      <div className="text-[11px] text-muted-foreground">{formatPKR(lifetimePKR)}</div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          client.status === "archived"
                            ? "border-muted-foreground/30 text-muted-foreground bg-muted font-medium"
                            : "border-primary/30 text-primary bg-primary/10 font-medium"
                        }
                      >
                        {client.status || "active"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted" title="Create Invoice for Client">
                          <Link href={`/invoices/new?client=${client.id}`}>
                            <FilePlus className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button onClick={() => handleOpenEdit(client)} size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted" title="Edit Client">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => setDeleteTarget({ id: client.id, name: client.name })} size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-muted" title="Delete Client">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Client Modal Overlay */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">
                {editingClient ? "Edit Client Details" : "Add New Client"}
              </h2>
              <button onClick={() => setIsAddOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Client Contact Name *</label>
                  <Input 
                    placeholder="John Doe" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                    className="bg-background border-input text-foreground"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Company Name</label>
                  <Input 
                    placeholder="TechFlow Inc." 
                    value={company} 
                    onChange={(e) => setCompany(e.target.value)} 
                    className="bg-background border-input text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Email Address</label>
                  <Input 
                    type="email" 
                    placeholder="billing@techflow.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="bg-background border-input text-foreground"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Phone Number</label>
                  <Input 
                    placeholder="+1 415 555 0199" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    className="bg-background border-input text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Platform</label>
                  <select 
                    value={platform} 
                    onChange={(e) => setPlatform(e.target.value)} 
                    className="w-full h-10 px-3 rounded-md bg-background border border-input text-foreground text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="upwork">Upwork Escrow</option>
                    <option value="fiverr">Fiverr Orders</option>
                    <option value="direct">Direct Client (Bank / Wise)</option>
                    <option value="freelancer">Freelancer.com</option>
                    <option value="other">Other Platform</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Billing Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-background border border-input text-foreground text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="PKR">PKR (Rs.)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-background border border-input text-foreground text-sm focus:border-primary focus:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Client Notes</label>
                <textarea 
                  placeholder="e.g. Pays via Wise or Upwork direct contract on 1st of every month." 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  rows={3} 
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  <Check className="mr-1.5 h-4 w-4" /> {editingClient ? "Update Client" : "Save Client"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CSVImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={deleteTarget?.warning ? "This will delete related records too" : "Delete Client Profile?"}
        description={
          deleteTarget?.warning
            ? deleteTarget.warning
            : deleteTarget
              ? `Delete "${deleteTarget.name}"? This cannot be undone.`
              : ""
        }
        confirmText={deleteTarget?.warning ? "Delete Anyway" : "Delete Client"}
        isLoading={deleteClientMutation.isPending}
      />

      {toast && (
        <Toast 
          type={toast.type} 
          title={toast.title} 
          message={toast.message} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
}

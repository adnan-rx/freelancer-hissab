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
import { formatPKR, formatUSD } from '@/lib/utils';
import { CSVImportModal } from '@/components/features/csv-import-modal';

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");

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

  const { data: clientsList = [], isLoading } = useClients(search);
  const createClientMutation = useCreateClient();
  const updateClientMutation = useUpdateClient();
  const deleteClientMutation = useDeleteClient();

  // Fallback initial dataset if database is unseeded
  const defaultClients = [
    { id: "c1", name: "TechFlow Inc.", company: "TechFlow Labs", platform: "upwork", email: "billing@techflow.com", phone: "+1 415 555 0199", currency: "USD", totalEarnings: 5000, status: "active" },
    { id: "c2", name: "Jane Smith", company: "Smith Studio", platform: "fiverr", email: "jane@smithstudio.io", phone: "+44 20 7946 0912", currency: "USD", totalEarnings: 1200, status: "active" },
    { id: "c3", name: "Global Soft LLC", company: "Global Soft", platform: "direct", email: "accounts@globalsoft.com", phone: "+971 4 321 4567", currency: "USD", totalEarnings: 8400, status: "active" },
  ];

  const rawList = clientsList.length > 0 ? clientsList : defaultClients;

  const displayClients = rawList.filter((client: any) => {
    const matchesPlatform = platformFilter === "all" || client.platform === platformFilter;
    const clientName = client.name || "";
    const matchesSearch = clientName.toLowerCase().includes(search.toLowerCase()) || 
                          (client.email && client.email.toLowerCase().includes(search.toLowerCase())) ||
                          (client.company && client.company.toLowerCase().includes(search.toLowerCase()));
    return matchesPlatform && matchesSearch;
  });

  const totalClientsCount = rawList.length;
  const totalLifetimeUSD = rawList.reduce((sum: number, c: any) => sum + (c.totalEarnings || c.totalIncome || 1000), 0);
  const totalLifetimePKR = totalLifetimeUSD * 280.50;

  const handleOpenAdd = () => {
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setPlatform("upwork");
    setCurrency("USD");
    setNotes("");
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
    setIsAddOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, company, email, phone, platform, currency, notes };

    try {
      if (editingClient) {
        await updateClientMutation.mutateAsync({ id: editingClient.id, ...payload });
      } else {
        await createClientMutation.mutateAsync(payload);
      }
      setIsAddOpen(false);
    } catch (err) {
      console.warn("Client save error:", err);
      setIsAddOpen(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this client?")) {
      try {
        await deleteClientMutation.mutateAsync(id);
      } catch (err) {
        console.warn("Delete client error:", err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Clients Directory</h1>
          <p className="text-sm text-slate-400 mt-1">Manage your international and local client roster, platforms, and contact details.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setIsImportOpen(true)}
            variant="outline" 
            className="border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800"
          >
            <Sparkles className="mr-2 h-4 w-4 text-emerald-400" /> Auto-Import Clients via CSV
          </Button>
          <Button onClick={handleOpenAdd} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20">
            <Plus className="mr-2 h-4 w-4" /> Add New Client
          </Button>
        </div>
      </div>

      {/* KPI Cards Banner */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">{totalClientsCount}</div>
            <p className="text-xs text-slate-400 mt-1">Registered Client Accounts</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Lifetime Revenue (USD)</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">{formatUSD(totalLifetimeUSD)}</div>
            <p className="text-xs text-emerald-400 mt-1 font-medium">Billed across all portals</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Converted Lifetime Earnings (PKR)</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{formatPKR(totalLifetimePKR)}</div>
            <p className="text-xs text-emerald-400 mt-1 font-medium">Auto-converted at ~280.50 PKR</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Platform Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
          {["all", "upwork", "fiverr", "direct", "freelancer"].map((pl) => (
            <button
              key={pl}
              onClick={() => setPlatformFilter(pl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                platformFilter === pl 
                  ? "bg-emerald-500 text-slate-950 shadow" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              {pl}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Search clients by name, company, email..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Clients Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
        <Table>
          <TableHeader className="bg-slate-900/80">
            <TableRow className="border-slate-800">
              <TableHead className="text-slate-300">Client / Company Name</TableHead>
              <TableHead className="text-slate-300">Platform</TableHead>
              <TableHead className="text-slate-300">Email & Contact</TableHead>
              <TableHead className="text-slate-300">Total Billed</TableHead>
              <TableHead className="text-slate-300">Status</TableHead>
              <TableHead className="text-right text-slate-300">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">Loading client directory...</TableCell>
              </TableRow>
            ) : displayClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">No clients found matching your search.</TableCell>
              </TableRow>
            ) : (
              displayClients.map((client: any) => {
                const lifetimeUSD = client.totalEarnings || client.totalIncome || 1000;
                return (
                  <TableRow key={client.id} className="border-slate-800 hover:bg-slate-800/40 transition-colors">
                    <TableCell>
                      <div className="font-semibold text-slate-100">{client.name}</div>
                      {client.company && <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Building className="h-3 w-3" /> {client.company}</div>}
                    </TableCell>

                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`capitalize ${
                          client.platform === "upwork" 
                            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" 
                            : client.platform === "fiverr"
                            ? "border-green-500/30 text-green-400 bg-green-500/10"
                            : "border-teal-500/30 text-teal-400 bg-teal-500/10"
                        }`}
                      >
                        {client.platform || "direct"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs space-y-0.5">
                      <div className="text-slate-300 flex items-center gap-1.5"><Mail className="h-3 w-3 text-slate-500" /> {client.email || "No email"}</div>
                      {client.phone && <div className="text-slate-500 flex items-center gap-1.5"><Phone className="h-3 w-3" /> {client.phone}</div>}
                    </TableCell>

                    <TableCell className="font-mono">
                      <div className="font-bold text-emerald-400">{formatUSD(lifetimeUSD)}</div>
                      <div className="text-[11px] text-slate-400">{formatPKR(lifetimeUSD * 280.50)}</div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                        {client.status || "active"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-emerald-400 hover:bg-slate-800" title="Create Invoice for Client">
                          <Link href={`/invoices/new?client=${client.id}`}>
                            <FilePlus className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button onClick={() => handleOpenEdit(client)} size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800" title="Edit Client">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => handleDelete(client.id)} size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-rose-400 hover:bg-slate-800" title="Delete Client">
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-slate-100">
                {editingClient ? "Edit Client Details" : "Add New Client"}
              </h2>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Client Contact Name *</label>
                  <Input 
                    placeholder="John Doe" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                    className="bg-slate-950 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Company Name</label>
                  <Input 
                    placeholder="TechFlow Inc." 
                    value={company} 
                    onChange={(e) => setCompany(e.target.value)} 
                    className="bg-slate-950 border-slate-800 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Email Address</label>
                  <Input 
                    type="email" 
                    placeholder="billing@techflow.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="bg-slate-950 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Phone Number</label>
                  <Input 
                    placeholder="+1 415 555 0199" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    className="bg-slate-950 border-slate-800 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Platform</label>
                  <select 
                    value={platform} 
                    onChange={(e) => setPlatform(e.target.value)} 
                    className="w-full h-10 px-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="upwork">Upwork Escrow</option>
                    <option value="fiverr">Fiverr Orders</option>
                    <option value="direct">Direct Client (Bank / Wise)</option>
                    <option value="freelancer">Freelancer.com</option>
                    <option value="other">Other Platform</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Billing Currency</label>
                  <select 
                    value={currency} 
                    onChange={(e) => setCurrency(e.target.value)} 
                    className="w-full h-10 px-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="PKR">PKR (Rs.)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Client Notes</label>
                <textarea 
                  placeholder="e.g. Pays via Wise or Upwork direct contract on 1st of every month." 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  rows={3} 
                  className="w-full rounded-md border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="border-slate-800 bg-slate-950 text-slate-300">
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold">
                  <Check className="mr-1.5 h-4 w-4" /> {editingClient ? "Update Client" : "Save Client"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CSVImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </div>
  );
}

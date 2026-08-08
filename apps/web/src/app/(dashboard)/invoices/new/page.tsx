"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Trash2, ArrowLeft, Save, FileText, Calculator } from 'lucide-react';
import Link from 'next/link';
import { formatPKR, formatUSD } from '@/lib/utils';
import { useClients } from '@/hooks/use-clients';
import { useCreateInvoice } from '@/hooks/use-invoices';

export default function NewInvoicePage() {
  const router = useRouter();
  const { data: clients = [] } = useClients();
  const createInvoiceMutation = useCreateInvoice();

  // Invoice Form State
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('TechFlow Inc.');
  const [clientEmail, setClientEmail] = useState('billing@techflow.com');
  const [invoiceNumber, setInvoiceNumber] = useState(`FH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10));
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(280.50);
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('Payment instructions: Wire foreign remittance directly to Meezan Bank IBAN: PK36MEZN0001020304050607 under SBP Code 9100.');

  // Line Items
  const [items, setItems] = useState([
    { description: 'Full Stack Web Development & API Integration', quantity: 1, rate: 1000 },
  ]);

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, rate: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.rate || 0)), 0);
  const taxAmount = subtotal * (Number(taxRate || 0) / 100);
  const total = subtotal + taxAmount - Number(discountAmount || 0);
  const totalPKR = total * Number(exchangeRate || 280.50);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      clientId: clientId || "client_dev_123",
      clientName,
      clientEmail,
      invoiceNumber,
      dueDate,
      currency,
      exchangeRate,
      taxRate,
      discountAmount,
      subtotal,
      total,
      totalPKR,
      notes,
      items,
      status: "sent",
    };

    try {
      await createInvoiceMutation.mutateAsync(payload);
      router.push(`/invoices`);
    } catch (err) {
      console.warn("API create invoice failed, navigating back to invoices:", err);
      router.push(`/invoices`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="text-slate-400 hover:text-slate-100">
            <Link href="/invoices"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-100">Create New Invoice</h1>
            <p className="text-sm text-slate-400 mt-0.5">Generate professional client invoice with automatic PKR exchange calculation.</p>
          </div>
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={createInvoiceMutation.isPending}
          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20"
        >
          <Save className="mr-2 h-4 w-4" /> Save & Send Invoice
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-400" /> Invoice Header & Client Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Select Client</label>
                <select 
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    const selected = clients.find((c: any) => c.id === e.target.value);
                    if (selected) {
                      setClientName(selected.name);
                      setClientEmail(selected.email || '');
                    }
                  }}
                  className="w-full h-10 px-3 rounded-md bg-slate-900 border border-slate-800 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select or Enter Below...</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.platform})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Client Name</label>
                <Input 
                  value={clientName} 
                  onChange={(e) => setClientName(e.target.value)} 
                  placeholder="TechFlow Inc."
                  required 
                  className="bg-slate-900 border-slate-800 text-slate-100"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Client Email</label>
                <Input 
                  type="email"
                  value={clientEmail} 
                  onChange={(e) => setClientEmail(e.target.value)} 
                  placeholder="billing@techflow.com"
                  className="bg-slate-900 border-slate-800 text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-slate-800/80">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Invoice Number</label>
                <Input 
                  value={invoiceNumber} 
                  onChange={(e) => setInvoiceNumber(e.target.value)} 
                  required 
                  className="bg-slate-900 border-slate-800 text-slate-100 font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Due Date</label>
                <Input 
                  type="date" 
                  value={dueDate} 
                  onChange={(e) => setDueDate(e.target.value)} 
                  required 
                  className="bg-slate-900 border-slate-800 text-slate-100 font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Billing Currency</label>
                <select 
                  value={currency} 
                  onChange={(e) => setCurrency(e.target.value)} 
                  className="w-full h-10 px-3 rounded-md bg-slate-900 border border-slate-800 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="PKR">PKR (Rs.)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Exchange Rate (PKR / {currency})</label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={exchangeRate} 
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)} 
                  className="bg-slate-900 border-slate-800 text-slate-100 font-mono text-emerald-400 font-bold"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items Card */}
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-100">Invoice Items & Services</CardTitle>
              <CardDescription className="text-slate-400">Add billable services, milestones, or hourly rates.</CardDescription>
            </div>
            <Button type="button" onClick={addItem} variant="outline" size="sm" className="border-slate-800 bg-slate-900 text-emerald-400 hover:bg-slate-800">
              <Plus className="mr-1.5 h-4 w-4" /> Add Item Row
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {items.map((item, index) => {
                const itemAmount = Number(item.quantity || 0) * Number(item.rate || 0);
                return (
                  <div key={index} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <Input 
                      placeholder="Item Description (e.g. Frontend React App Development)" 
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      required
                      className="flex-1 bg-slate-900 border-slate-800 text-slate-100"
                    />
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <Input 
                        type="number" 
                        min="1" 
                        placeholder="Qty" 
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-20 bg-slate-900 border-slate-800 text-slate-100 text-center"
                      />
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        placeholder="Rate" 
                        value={item.rate}
                        onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-28 bg-slate-900 border-slate-800 text-slate-100 text-right font-mono"
                      />
                      <div className="w-28 text-right font-mono font-bold text-emerald-400">
                        {currency === "USD" ? formatUSD(itemAmount) : `${currency} ${itemAmount.toFixed(2)}`}
                      </div>
                      <Button 
                        type="button" 
                        onClick={() => removeItem(index)} 
                        variant="ghost" 
                        size="icon" 
                        disabled={items.length === 1}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calculations Box */}
            <div className="flex flex-col md:flex-row justify-between items-start pt-6 border-t border-slate-800 gap-6">
              <div className="flex-1 space-y-2 max-w-md">
                <label className="text-sm font-medium text-slate-300">Invoice Payment Notes & Wire Instructions</label>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="w-full md:w-80 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-200">{currency === "USD" ? formatUSD(subtotal) : `${currency} ${subtotal.toFixed(2)}`}</span>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400">Tax Rate (%):</span>
                  <Input 
                    type="number" 
                    value={taxRate} 
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} 
                    className="w-20 h-7 text-xs bg-slate-900 border-slate-800 text-right font-mono"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400">Discount Amount ({currency}):</span>
                  <Input 
                    type="number" 
                    value={discountAmount} 
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} 
                    className="w-20 h-7 text-xs bg-slate-900 border-slate-800 text-right font-mono"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-slate-100">
                  <span>Total Billed:</span>
                  <span className="font-mono text-emerald-400">{currency === "USD" ? formatUSD(total) : `${currency} ${total.toFixed(2)}`}</span>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center text-xs">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Calculator className="h-3.5 w-3.5" /> Total PKR Conversion:
                  </span>
                  <span className="font-bold text-emerald-400 font-mono text-sm">{formatPKR(totalPKR)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button asChild type="button" variant="outline" className="border-slate-800 bg-slate-900 text-slate-300">
            <Link href="/invoices">Cancel</Link>
          </Button>
          <Button 
            type="submit" 
            disabled={createInvoiceMutation.isPending}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-8 h-11 shadow-lg shadow-emerald-500/20"
          >
            {createInvoiceMutation.isPending ? "Creating Invoice..." : "Save & Generate Invoice"}
          </Button>
        </div>
      </form>
    </div>
  );
}

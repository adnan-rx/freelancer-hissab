"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Trash2, ArrowLeft, Save, FileText, Calculator, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { formatPKR, formatUSD, apiErrorMessage } from '@/lib/utils';
import { useClients } from '@/hooks/use-clients';
import { useCreateInvoice } from '@/hooks/use-invoices';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { useProfile } from '@/hooks/use-profile';

import { Toast } from '@/components/ui/toast';

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get('client') || '';

  const { data: clients = [] } = useClients();
  const { data: profile } = useProfile();
  const createInvoiceMutation = useCreateInvoice();

  const [toast, setToast] = useState<{ type: 'error' | 'success'; title?: string; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceNumberEdited, setInvoiceNumberEdited] = useState(false);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10));
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(280.5);

  const { data: liveRate, isLoading: isRateLoading } = useExchangeRate(currency);

  useEffect(() => {
    if (liveRate && liveRate > 0) {
      setExchangeRate(liveRate);
    }
  }, [liveRate, currency]);

  // Pre-select the client passed via ?client=<id> from the Clients page "create invoice" action.
  useEffect(() => {
    if (!preselectedClientId || clients.length === 0) return;
    const match = clients.find((c: any) => c.id === preselectedClientId);
    if (match) {
      setClientId(match.id);
      setClientName(match.name);
      setClientEmail(match.email || '');
      if (match.currency) setCurrency(match.currency);
    }
  }, [preselectedClientId, clients]);

  // The invoice number preview follows the Settings prefix until the user types their own.
  useEffect(() => {
    if (invoiceNumberEdited) return;
    const prefix = profile?.invoicePrefix || `FH-${new Date().getFullYear()}-`;
    setInvoiceNumber(`${prefix}${Math.floor(1000 + Math.random() * 9000)}`);
  }, [profile?.invoicePrefix, invoiceNumberEdited]);

  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [notesEdited, setNotesEdited] = useState(false);

  useEffect(() => {
    if (notesEdited) return;
    if (profile?.invoiceNotes) setNotes(profile.invoiceNotes);
  }, [profile?.invoiceNotes, notesEdited]);

  const [items, setItems] = useState([{ description: '', quantity: 1, rate: 0 }]);

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

  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.rate || 0), 0);
  const taxAmount = subtotal * (Number(taxRate || 0) / 100);
  const total = subtotal + taxAmount - Number(discountAmount || 0);
  const totalPKR = total * Number(exchangeRate || 280.5);

  const handleSubmit = async (e: React.FormEvent, targetStatus: string = 'sent') => {
    e.preventDefault();
    setToast(null);
    setFormError(null);

    if (!clientName.trim()) {
      setFormError('Enter a client name.');
      return;
    }
    if (items.some((item) => !item.description.trim())) {
      setFormError('Every line item needs a description.');
      return;
    }
    if (items.some((item) => Number(item.quantity) <= 0 || Number(item.rate) < 0)) {
      setFormError('Quantity must be greater than zero and rate cannot be negative.');
      return;
    }
    if (total < 0) {
      setFormError('The total is negative — check the discount amount against the subtotal.');
      return;
    }

    const payload = {
      clientId: clientId || undefined,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      dueDate,
      currency,
      exchangeRate,
      taxRate,
      discountAmount,
      subtotal,
      total,
      totalPKR,
      notes,
      status: targetStatus,
      items,
    };

    try {
      await createInvoiceMutation.mutateAsync(payload);
      router.push(`/invoices`);
    } catch (err: any) {
      setToast({
        type: 'error',
        title: 'Could Not Create Invoice',
        message: apiErrorMessage(err, 'Failed to create invoice.'),
      });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Link href="/invoices"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Create New Invoice</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Generate professional client invoice with automatic PKR exchange calculation.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={(e) => handleSubmit(e, 'draft')}
            disabled={createInvoiceMutation.isPending}
          >
            Save as Draft
          </Button>
          <Button onClick={(e) => handleSubmit(e, 'sent')} disabled={createInvoiceMutation.isPending}>
            <Save className="mr-2 h-4 w-4" /> Save & Send Invoice
          </Button>
        </div>
      </div>

      {formError && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Invoice Header & Client Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Select Client</label>
                <select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    const selected = clients.find((c: any) => c.id === e.target.value);
                    if (selected) {
                      setClientName(selected.name);
                      setClientEmail(selected.email || '');
                      if (selected.currency) setCurrency(selected.currency);
                    }
                  }}
                  className="w-full h-10 px-3 rounded-md bg-background border border-input text-foreground text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">Select or Enter Below...</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.platform})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Client Name</label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="TechFlow Inc."
                  maxLength={255}
                  required
                  className="bg-background border-input text-foreground"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Client Email</label>
                <Input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="billing@techflow.com"
                  className="bg-background border-input text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-border">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Invoice Number</label>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => { setInvoiceNumber(e.target.value); setInvoiceNumberEdited(true); }}
                  required
                  className="bg-background border-input text-foreground font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Due Date</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="bg-background border-input text-foreground font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Billing Currency</label>
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Exchange Rate (PKR / {currency})</label>
                  <span className="text-[11px] text-primary font-medium flex items-center gap-1">
                    {isRateLoading ? "Fetching live rate..." : "Live Market Rate"}
                  </span>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={exchangeRate || ""}
                  placeholder="e.g. 280.50"
                  onChange={(e) => setExchangeRate(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                  className="bg-background border-input text-primary font-mono font-bold"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-foreground">Invoice Items & Services</CardTitle>
              <CardDescription>Add billable services, milestones, or hourly rates.</CardDescription>
            </div>
            <Button type="button" onClick={addItem} variant="outline" size="sm" className="text-primary hover:text-primary">
              <Plus className="mr-1.5 h-4 w-4" /> Add Item Row
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {/* Header Row for Line Items - Hidden on mobile, visible on md+ screens */}
              <div className="hidden md:flex flex-row gap-3 items-center px-1 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <div className="flex-1">Description</div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="w-20 text-center">Qty</div>
                  <div className="w-28 text-right">Rate</div>
                  <div className="w-28 text-right">Amount</div>
                  <div className="w-9"></div>
                </div>
              </div>
              {items.map((item, index) => {
                const itemAmount = Number(item.quantity || 0) * Number(item.rate || 0);
                return (
                  <div key={index} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-muted/50 p-3 rounded-xl border border-border">
                    <Input
                      placeholder="Item Description (e.g. Frontend React App Development)"
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      maxLength={500}
                      required
                      className="flex-1 bg-background border-input text-foreground"
                    />
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-20 bg-background border-input text-foreground text-center"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Rate"
                        value={item.rate}
                        onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-28 bg-background border-input text-foreground text-right font-mono"
                      />
                      <div className="w-28 text-right font-mono font-bold text-primary">
                        {currency === "USD" ? formatUSD(itemAmount) : `${currency} ${itemAmount.toFixed(2)}`}
                      </div>
                      <Button
                        type="button"
                        onClick={() => removeItem(index)}
                        variant="ghost"
                        size="icon"
                        disabled={items.length === 1}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calculations Box */}
            <div className="flex flex-col md:flex-row justify-between items-start pt-6 border-t border-border gap-6">
              <div className="flex-1 space-y-2 max-w-md">
                <label className="text-sm font-medium text-foreground">Invoice Payment Notes & Wire Instructions</label>
                <textarea
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); setNotesEdited(true); }}
                  rows={4}
                  maxLength={1000}
                  className="w-full rounded-md border border-input bg-background p-3 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="w-full md:w-80 bg-muted/30 p-4 rounded-xl border border-border space-y-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-mono text-foreground">{currency === "USD" ? formatUSD(subtotal) : `${currency} ${subtotal.toFixed(2)}`}</span>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Tax Rate (%):</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-20 h-7 text-xs bg-background border-input text-right font-mono"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Discount Amount ({currency}):</span>
                  <Input
                    type="number"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="w-20 h-7 text-xs bg-background border-input text-right font-mono"
                  />
                </div>

                <div className="pt-2 border-t border-border flex justify-between font-bold text-foreground">
                  <span>Total Billed:</span>
                  <span className={`font-mono ${total < 0 ? "text-destructive" : "text-primary"}`}>
                    {currency === "USD" ? formatUSD(total) : `${currency} ${total.toFixed(2)}`}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 flex justify-between items-center text-xs">
                  <span className="text-primary font-semibold flex items-center gap-1">
                    <Calculator className="h-3.5 w-3.5" /> Total PKR Conversion:
                  </span>
                  <span className="font-bold text-primary font-mono text-sm">{formatPKR(totalPKR)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button asChild type="button" variant="outline">
            <Link href="/invoices">Cancel</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={(e) => handleSubmit(e, 'draft')}
            disabled={createInvoiceMutation.isPending}
          >
            Save as Draft
          </Button>
          <Button
            type="submit"
            disabled={createInvoiceMutation.isPending}
            className="px-8"
          >
            {createInvoiceMutation.isPending ? "Creating Invoice..." : "Save & Send Invoice"}
          </Button>
        </div>
      </form>

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

"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Loader2, Plus, Send, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/ui/page-header';
import { formatPKR, formatMoney, apiErrorMessage } from '@/lib/utils';
import { useClients } from '@/hooks/use-clients';
import { useCreateInvoice, useNextInvoiceNumber } from '@/hooks/use-invoices';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { useProfile } from '@/hooks/use-profile';
import { useToast } from '@/providers/toast-provider';

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get('client') || '';

  const { data: clients = [] } = useClients();
  const { data: profile } = useProfile();
  const { data: nextInvoiceNumber } = useNextInvoiceNumber();
  const createInvoiceMutation = useCreateInvoice();
  const { showSuccess, showError } = useToast();

  const [formError, setFormError] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceNumberEdited, setInvoiceNumberEdited] = useState(false);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10));
  const [currency, setCurrency] = useState('USD');
  // No hardcoded seed value — starts unset and is populated by the live rate
  // below, rather than silently defaulting to a stale-looking "280.5".
  const [exchangeRate, setExchangeRate] = useState(0);

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

  // The invoice number preview follows the server's next sequential number
  // until the user types their own. This used to be a random 4-digit suffix,
  // which tax authorities generally expect NOT to be — invoice numbering is
  // meant to be sequential and gap-free for audit purposes — and could also
  // collide with an existing number, only surfacing as a 409 at submit time.
  useEffect(() => {
    if (invoiceNumberEdited || !nextInvoiceNumber) return;
    setInvoiceNumber(nextInvoiceNumber);
  }, [nextInvoiceNumber, invoiceNumberEdited]);

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
  const totalPKR = total * Number(exchangeRate || 0);
  const money = (value: number) => formatMoney(value, currency);

  const handleSubmit = async (e: React.FormEvent, targetStatus: string = 'sent') => {
    e.preventDefault();
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
    if (!exchangeRate || exchangeRate <= 0) {
      setFormError('Enter an exchange rate greater than zero.');
      return;
    }

    // subtotal/total/totalPKR are NOT sent: the server recalculates them from
    // items + taxRate + discountAmount + exchangeRate and always wins, so
    // sending a client-computed figure was redundant at best and, since the
    // API validates DTOs strictly, would now be rejected outright.
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
      notes,
      status: targetStatus,
      items,
    };

    try {
      await createInvoiceMutation.mutateAsync(payload);
      // Raised before navigating away: the toast lives in a provider mounted
      // above the router, so it survives the route change instead of
      // unmounting with this page.
      showSuccess(`Invoice ${invoiceNumber || ''} created.`.trim(), 'Invoice created');
      router.push(`/invoices`);
    } catch (err: any) {
      showError(apiErrorMessage(err, 'Failed to create invoice.'), "Couldn't create invoice");
    }
  };

  const isSaving = createInvoiceMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-8">
      <PageHeader
        backHref="/invoices"
        backLabel="All invoices"
        title="New invoice"
        description="Bill in any currency — the PKR conversion is worked out as you type."
        actions={
          <>
            <Button type="button" variant="outline" onClick={(e) => handleSubmit(e, 'draft')} disabled={isSaving}>
              Save draft
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Send />} Save &amp; send
            </Button>
          </>
        }
      />

      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-destructive/15 bg-destructive-surface p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="leading-relaxed">{formError}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6 lg:items-start">
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          <Card>
            <CardToolbar>
              <div className="space-y-1">
                <CardTitle>Client and terms</CardTitle>
                <CardDescription>Pick an existing client, or type a name to create one.</CardDescription>
              </div>
            </CardToolbar>
            <CardContent className="space-y-5 pt-5 sm:pt-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Existing client" htmlFor="inv-client">
                  <Select
                    value={clientId || "none"}
                    onValueChange={(value) => {
                      const id = value === "none" ? "" : value;
                      setClientId(id);
                      const selected = clients.find((c: any) => c.id === id);
                      if (selected) {
                        setClientName(selected.name);
                        setClientEmail(selected.email || '');
                        if (selected.currency) setCurrency(selected.currency);
                      }
                    }}
                  >
                    <SelectTrigger id="inv-client">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">New client…</SelectItem>
                      {clients.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Client name" htmlFor="inv-client-name" required>
                  <Input
                    id="inv-client-name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Northwind Studio"
                    maxLength={255}
                    required
                  />
                </Field>

                <Field label="Client email" htmlFor="inv-client-email">
                  <Input
                    id="inv-client-email"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="billing@northwind.co"
                  />
                </Field>
              </div>

              <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2 xl:grid-cols-4">
                <Field label="Invoice number" htmlFor="inv-number" required>
                  <Input
                    id="inv-number"
                    value={invoiceNumber}
                    onChange={(e) => {
                      setInvoiceNumber(e.target.value);
                      setInvoiceNumberEdited(true);
                    }}
                    required
                    className="font-mono"
                  />
                </Field>

                <Field label="Due date" htmlFor="inv-due" required>
                  <Input
                    id="inv-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </Field>

                <Field label="Currency" htmlFor="inv-currency">
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="inv-currency">
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

                <Field
                  label={`Rate (PKR per ${currency})`}
                  htmlFor="inv-rate"
                  hint={isRateLoading ? "Fetching the live rate…" : exchangeRate > 0 ? "Live market rate — override if your bank differs." : "Enter the rate manually."}
                >
                  <Input
                    id="inv-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={exchangeRate || ""}
                    placeholder="280.00"
                    onChange={(e) => setExchangeRate(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                    className="font-mono tabular-nums"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardToolbar>
              <div className="space-y-1">
                <CardTitle>Line items</CardTitle>
                <CardDescription>Services, milestones or hours.</CardDescription>
              </div>
              <Button type="button" onClick={addItem} variant="outline" size="sm">
                <Plus /> Add item
              </Button>
            </CardToolbar>

            <CardContent className="space-y-3 pt-5 sm:pt-6">
              {/* Column labels only make sense once the row is laid out horizontally. */}
              <div className="hidden items-center gap-3 px-3 md:flex">
                <span className="flex-1 text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Description
                </span>
                <span className="w-20 text-center text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Qty
                </span>
                <span className="w-28 text-right text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Rate
                </span>
                <span className="w-28 text-right text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Amount
                </span>
                <span className="w-8" />
              </div>

              {items.map((item, index) => {
                const itemAmount = Number(item.quantity || 0) * Number(item.rate || 0);
                return (
                  <div
                    key={index}
                    className="flex flex-col gap-3 rounded-md border border-border bg-muted/40 p-3 md:flex-row md:items-center"
                  >
                    <Input
                      placeholder="Frontend build — sprint 3"
                      aria-label={`Item ${index + 1} description`}
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      maxLength={500}
                      required
                      className="flex-1"
                    />
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        aria-label={`Item ${index + 1} quantity`}
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-20 text-center font-mono tabular-nums"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`Item ${index + 1} rate`}
                        value={item.rate}
                        onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-28 text-right font-mono tabular-nums"
                      />
                      <span className="w-28 text-right font-mono text-sm font-medium tabular-nums text-foreground">
                        {money(itemAmount)}
                      </span>
                      <Button
                        type="button"
                        onClick={() => removeItem(index)}
                        variant="ghost"
                        size="icon-sm"
                        disabled={items.length === 1}
                        className="hover:bg-destructive-surface hover:text-destructive"
                        title="Remove item"
                      >
                        <Trash2 />
                        <span className="sr-only">Remove item {index + 1}</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardToolbar>
              <div className="space-y-1">
                <CardTitle>Payment notes</CardTitle>
                <CardDescription>Wire instructions printed at the bottom of the invoice.</CardDescription>
              </div>
            </CardToolbar>
            <CardContent className="pt-5 sm:pt-6">
              <Textarea
                value={notes}
                aria-label="Payment notes and wire instructions"
                onChange={(e) => {
                  setNotes(e.target.value);
                  setNotesEdited(true);
                }}
                rows={4}
                maxLength={1000}
                placeholder="Bank name, IBAN, SWIFT and the SBP purpose code to quote."
              />
            </CardContent>
          </Card>
        </div>

        {/* Totals stay in view while the items list grows. */}
        <Card className="lg:sticky lg:top-6">
          <CardToolbar>
            <CardTitle>Summary</CardTitle>
          </CardToolbar>
          <CardContent className="space-y-4 pt-5 sm:pt-6">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono font-medium tabular-nums text-foreground">{money(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="inv-tax" className="text-sm font-normal text-muted-foreground">
                Tax rate (%)
              </Label>
              <Input
                id="inv-tax"
                type="number"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="h-8 w-24 text-right font-mono tabular-nums"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="inv-discount" className="text-sm font-normal text-muted-foreground">
                Discount ({currency})
              </Label>
              <Input
                id="inv-discount"
                type="number"
                min="0"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                className="h-8 w-24 text-right font-mono tabular-nums"
              />
            </div>

            <div className="flex justify-between border-t border-border pt-4 text-sm">
              <span className="font-medium text-foreground">Total billed</span>
              <span
                className={`font-mono text-base font-semibold tabular-nums ${total < 0 ? "text-destructive" : "text-foreground"}`}
              >
                {money(total)}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5">
              <span className="text-sm font-medium text-brand-800">In PKR</span>
              <span className="font-mono text-base font-semibold tabular-nums text-brand-900">{formatPKR(totalPKR)}</span>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Button type="submit" disabled={isSaving} className="w-full">
                {isSaving ? <Loader2 className="animate-spin" /> : <Send />} Save &amp; send
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={(e) => handleSubmit(e, 'draft')}
                disabled={isSaving}
                className="w-full"
              >
                Save as draft
              </Button>
              <Button asChild type="button" variant="ghost" className="w-full">
                <Link href="/invoices">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

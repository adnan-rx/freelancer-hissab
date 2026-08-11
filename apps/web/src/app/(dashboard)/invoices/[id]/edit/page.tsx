"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock, Plus, Save, Send, Trash2 } from "lucide-react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceStatusBadge } from "@/components/ui/status-badge";
import { formatPKR, formatMoney, apiErrorMessage } from "@/lib/utils";
import { useClients } from "@/hooks/use-clients";
import { useInvoice, useUpdateInvoice } from "@/hooks/use-invoices";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import { useToast } from "@/providers/toast-provider";

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: rawInvoice, isLoading, isError, error } = useInvoice(id);
  const { data: clients = [] } = useClients();
  const updateInvoiceMutation = useUpdateInvoice();
  const { showSuccess, showError } = useToast();

  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [initialized, setInitialized] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ description: "", quantity: 1, rate: 0 }]);

  const { data: liveRate } = useExchangeRate(currency);
  // Distinguishes the user picking a new currency from the initial load
  // setting `currency` from the invoice's own record — only the former
  // should overwrite the exchange rate with today's live rate. Getting this
  // wrong would silently replace a paid/historical invoice's recorded rate
  // with today's rate just because some other field was edited.
  const [currencyEdited, setCurrencyEdited] = useState(false);

  // Was fetched but never applied — unlike the "new invoice" form, changing
  // currency here left the exchange rate exactly where it was instead of
  // refreshing to the live rate for the new currency.
  useEffect(() => {
    if (currencyEdited && liveRate && liveRate > 0) {
      setExchangeRate(liveRate);
    }
  }, [liveRate, currencyEdited]);

  useEffect(() => {
    if (rawInvoice && !initialized) {
      setClientId(rawInvoice.clientId || rawInvoice.client?.id || "");
      setClientName(rawInvoice.client?.name || rawInvoice.clientName || "");
      setClientEmail(rawInvoice.client?.email || rawInvoice.clientEmail || "");
      setInvoiceNumber(rawInvoice.invoiceNumber || "");
      setDueDate(
        rawInvoice.dueDate
          ? typeof rawInvoice.dueDate === "string"
            ? rawInvoice.dueDate.split("T")[0]
            : new Date(rawInvoice.dueDate).toISOString().split("T")[0]
          : ""
      );
      setCurrency(rawInvoice.currency || "USD");
      setExchangeRate(parseFloat(rawInvoice.exchangeRate || "0"));
      setTaxRate(parseFloat(rawInvoice.taxRate || "0"));
      setDiscountAmount(parseFloat(rawInvoice.discountAmount || "0"));
      setNotes(rawInvoice.notes || "");

      if (Array.isArray(rawInvoice.items) && rawInvoice.items.length > 0) {
        setItems(
          rawInvoice.items.map((it: any) => ({
            description: it.description || "",
            quantity: parseFloat(it.quantity || "1"),
            rate: parseFloat(it.rate || "0"),
          }))
        );
      }
      setInitialized(true);
    }
  }, [rawInvoice, initialized]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (isError || !rawInvoice) {
    return (
      <Card className="mx-auto max-w-lg">
        <ErrorState
          title="Invoice not found"
          description={apiErrorMessage(error, "This invoice doesn't exist or could not be loaded.")}
          action={
            <Button asChild variant="outline">
              <Link href="/invoices">Back to invoices</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  const currentStatus = rawInvoice.status;
  const isDraft = currentStatus === "draft";
  const isLocked = currentStatus === "paid" || currentStatus === "cancelled";

  // Lock screen guard for paid or cancelled invoices
  if (isLocked) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="flex flex-col items-center p-8 pt-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden="true">
            <Lock className="size-6" />
          </span>
          <h1 className="mt-5 text-lg font-semibold tracking-[-0.01em] text-foreground">
            {currentStatus === "paid" ? "This invoice is locked" : "This invoice is cancelled"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{rawInvoice.invoiceNumber}</span> can no longer be
            edited.
          </p>

          <div
            className={`mt-6 w-full rounded-md border p-4 text-left ${
              currentStatus === "paid" ? "border-brand-200 bg-brand-50" : "border-border bg-muted/50"
            }`}
          >
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              {currentStatus === "paid" ? (
                <CheckCircle2 className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
              ) : (
                <AlertCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              {currentStatus === "paid" ? "Settled and recognised as income" : "Kept for the audit trail"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {currentStatus === "paid"
                ? "Editing a paid invoice would break FBR income reporting, contradict the bank's Proceeds Realization Certificate, and throw off your wealth reconciliation."
                : "Cancelled invoices are retained so invoice numbering stays sequential and gap-free."}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/invoices">Back to invoices</Link>
            </Button>
            <Button asChild>
              <Link href={`/invoices/${id}`}>View invoice</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, rate: 0 }]);
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
  const calculatedTaxAmount = subtotal * (Number(taxRate || 0) / 100);
  const total = subtotal + calculatedTaxAmount - Number(discountAmount || 0);
  const totalPKR = total * Number(exchangeRate || 0);
  const money = (value: number) => formatMoney(value, currency);

  const handleSubmit = async (e: React.FormEvent, targetStatus?: string) => {
    e.preventDefault();
    setFormError(null);

    if (!clientName.trim()) {
      setFormError("Enter a client name.");
      return;
    }
    if (items.some((item) => !item.description.trim())) {
      setFormError("Every line item needs a description.");
      return;
    }
    if (items.some((item) => Number(item.quantity) <= 0 || Number(item.rate) < 0)) {
      setFormError("Quantity must be greater than zero and rate cannot be negative.");
      return;
    }
    if (total < 0) {
      setFormError("The total is negative — check the discount amount against the subtotal.");
      return;
    }
    if (!exchangeRate || exchangeRate <= 0) {
      setFormError("Enter an exchange rate greater than zero.");
      return;
    }

    const payload: any = {
      dueDate: dueDate || undefined,
      currency,
      exchangeRate: Number(exchangeRate),
      taxRate: Number(taxRate),
      discountAmount: Number(discountAmount),
      notes,
      items: items.map((it) => ({
        description: it.description.trim(),
        quantity: Number(it.quantity),
        rate: Number(it.rate),
      })),
    };

    if (isDraft) {
      if (clientId) payload.clientId = clientId;
      if (clientName) payload.clientName = clientName.trim();
      if (clientEmail) payload.clientEmail = clientEmail.trim();
      if (invoiceNumber) payload.invoiceNumber = invoiceNumber.trim();
      if (targetStatus) payload.status = targetStatus;
    }

    try {
      await updateInvoiceMutation.mutateAsync({ id, payload });
      // The toast lives in a provider mounted above the router, so it's safe
      // to navigate immediately — no more artificial delay to let it be seen
      // before the page it was rendered on unmounts.
      showSuccess(`Changes to "${invoiceNumber || rawInvoice.invoiceNumber}" have been saved.`, "Invoice updated");
      router.push(`/invoices/${id}`);
    } catch (err: any) {
      showError(apiErrorMessage(err, "Failed to update invoice."), "Couldn't update invoice");
    }
  };

  const isSaving = updateInvoiceMutation.isPending;

  return (
    <form onSubmit={(e) => handleSubmit(e)} className="space-y-6 lg:space-y-8">
      <PageHeader
        backHref={`/invoices/${id}`}
        backLabel="Back to invoice"
        title={`Edit ${rawInvoice.invoiceNumber}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <InvoiceStatusBadge status={currentStatus} />
            <span>
              {isDraft
                ? "Everything is editable while this is a draft."
                : "Line items, dates and values can change; totals are recalculated on the server."}
            </span>
          </span>
        }
        actions={
          <>
            {isDraft && (
              <Button type="button" variant="outline" onClick={(e) => handleSubmit(e, "sent")} disabled={isSaving}>
                <Send /> Save &amp; issue
              </Button>
            )}
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
              {isDraft ? "Save draft" : "Save changes"}
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

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start lg:gap-6">
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          <Card>
            <CardToolbar>
              <div className="space-y-1">
                <CardTitle>Client and terms</CardTitle>
                {!isDraft && (
                  <CardDescription className="flex items-center gap-1.5">
                    <Lock className="size-3 shrink-0" aria-hidden="true" />
                    Invoice number and client are fixed once an invoice has been issued.
                  </CardDescription>
                )}
              </div>
            </CardToolbar>
            <CardContent className="space-y-5 pt-5 sm:pt-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Client" htmlFor="edit-client">
                  {isDraft ? (
                    <Select
                      value={clientId || "none"}
                      onValueChange={(value) => {
                        const nextId = value === "none" ? "" : value;
                        setClientId(nextId);
                        const selected = clients.find((c: any) => c.id === nextId);
                        if (selected) {
                          setClientName(selected.name);
                          setClientEmail(selected.email || "");
                          if (selected.currency) {
                            setCurrency(selected.currency);
                            setCurrencyEdited(true);
                          }
                        }
                      }}
                    >
                      <SelectTrigger id="edit-client">
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
                  ) : (
                    <Input id="edit-client" value={clientName} disabled />
                  )}
                </Field>

                <Field label="Client name" htmlFor="edit-client-name" required>
                  <Input
                    id="edit-client-name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    disabled={!isDraft}
                    placeholder="Northwind Studio"
                    required
                  />
                </Field>

                <Field label="Client email" htmlFor="edit-client-email">
                  <Input
                    id="edit-client-email"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    disabled={!isDraft}
                    placeholder="billing@northwind.co"
                  />
                </Field>
              </div>

              <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2 xl:grid-cols-4">
                <Field label="Invoice number" htmlFor="edit-number" required>
                  <Input
                    id="edit-number"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    disabled={!isDraft}
                    required
                    className="font-mono"
                  />
                </Field>

                <Field label="Due date" htmlFor="edit-due" required>
                  <Input
                    id="edit-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </Field>

                <Field label="Currency" htmlFor="edit-currency">
                  <Select
                    value={currency}
                    onValueChange={(value) => {
                      setCurrency(value);
                      setCurrencyEdited(true);
                    }}
                  >
                    <SelectTrigger id="edit-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="AED">AED (د.إ)</SelectItem>
                      <SelectItem value="SAR">SAR (﷼)</SelectItem>
                      <SelectItem value="CAD">CAD ($)</SelectItem>
                      <SelectItem value="AUD">AUD ($)</SelectItem>
                      <SelectItem value="PKR">PKR (Rs)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label={`Rate (PKR per ${currency})`} htmlFor="edit-rate">
                  <Input
                    id="edit-rate"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
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
                <CardDescription>Tasks, milestones or services provided.</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus /> Add item
              </Button>
            </CardToolbar>
            <CardContent className="space-y-3 pt-5 sm:pt-6">
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

              {items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-3 rounded-md border border-border bg-muted/40 p-3 md:flex-row md:items-center"
                >
                  <Input
                    placeholder="Frontend build — sprint 3"
                    aria-label={`Item ${index + 1} description`}
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    required
                    maxLength={500}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      aria-label={`Item ${index + 1} quantity`}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                      required
                      className="w-20 text-center font-mono tabular-nums"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      aria-label={`Item ${index + 1} rate`}
                      value={item.rate}
                      onChange={(e) => updateItem(index, "rate", e.target.value)}
                      required
                      className="w-28 text-right font-mono tabular-nums"
                    />
                    <span className="w-28 text-right font-mono text-sm font-medium tabular-nums text-foreground">
                      {money(Number(item.quantity || 0) * Number(item.rate || 0))}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="hover:bg-destructive-surface hover:text-destructive"
                      title="Remove item"
                    >
                      <Trash2 />
                      <span className="sr-only">Remove item {index + 1}</span>
                    </Button>
                  </div>
                </div>
              ))}
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
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Bank name, IBAN, SWIFT and the SBP purpose code to quote."
                rows={5}
              />
            </CardContent>
          </Card>
        </div>

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
              <Label htmlFor="edit-tax" className="text-sm font-normal text-muted-foreground">
                Tax rate (%)
              </Label>
              <Input
                id="edit-tax"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="h-8 w-24 text-right font-mono tabular-nums"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="edit-discount" className="text-sm font-normal text-muted-foreground">
                Discount ({currency})
              </Label>
              <Input
                id="edit-discount"
                type="number"
                step="0.01"
                min="0"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                className="h-8 w-24 text-right font-mono tabular-nums"
              />
            </div>

            <div className="flex justify-between border-t border-border pt-4 text-sm">
              <span className="font-medium text-foreground">Total due</span>
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
                {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                {isDraft ? "Save draft" : "Save changes"}
              </Button>
              {isDraft && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => handleSubmit(e, "sent")}
                  disabled={isSaving}
                  className="w-full"
                >
                  <Send /> Save &amp; issue
                </Button>
              )}
              <Button asChild type="button" variant="ghost" className="w-full">
                <Link href={`/invoices/${id}`}>Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

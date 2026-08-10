"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  FileText,
  AlertCircle,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Send,
} from "lucide-react";
import Link from "next/link";
import { formatPKR, formatUSD, apiErrorMessage } from "@/lib/utils";
import { useClients } from "@/hooks/use-clients";
import { useInvoice, useUpdateInvoice } from "@/hooks/use-invoices";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import { Toast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: rawInvoice, isLoading, isError, error } = useInvoice(id);
  const { data: clients = [] } = useClients();
  const updateInvoiceMutation = useUpdateInvoice();

  const [toast, setToast] = useState<{ type: "error" | "success"; title?: string; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [initialized, setInitialized] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState(280.5);
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("draft");
  const [items, setItems] = useState([{ description: "", quantity: 1, rate: 0 }]);

  const { data: liveRate } = useExchangeRate(currency);

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
      setExchangeRate(parseFloat(rawInvoice.exchangeRate || "280.5"));
      setTaxRate(parseFloat(rawInvoice.taxRate || "0"));
      setDiscountAmount(parseFloat(rawInvoice.discountAmount || "0"));
      setNotes(rawInvoice.notes || "");
      setStatus(rawInvoice.status || "draft");

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
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-56" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !rawInvoice) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-4">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-xl font-bold text-foreground">Invoice not found</h1>
        <p className="text-sm text-muted-foreground">
          {apiErrorMessage(error, "This invoice does not exist or could not be loaded.")}
        </p>
        <Button asChild variant="outline">
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Invoices
          </Link>
        </Button>
      </div>
    );
  }

  const currentStatus = rawInvoice.status;
  const isDraft = currentStatus === "draft";
  const isLocked = currentStatus === "paid" || currentStatus === "cancelled";

  // Lock Screen Guard for Paid or Cancelled Invoices
  if (isLocked) {
    return (
      <div className="max-w-xl mx-auto py-12 space-y-6">
        <Card className="border-border shadow-md">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl font-bold text-foreground">
              {currentStatus === "paid" ? "Invoice is Legally Locked" : "Invoice is Cancelled"}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              Invoice <span className="font-mono font-semibold text-foreground">{rawInvoice.invoiceNumber}</span> cannot be edited.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {currentStatus === "paid" ? (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-xs text-foreground text-left space-y-2">
                <p className="font-semibold text-primary flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Paid & Realized Income Record
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  This invoice has been settled and recognized in your financial records. Modifying paid invoices violates
                  Pakistan FBR income reporting rules, alters Bank Proceeds Realisation Certificates (PRC), and corrupts
                  wealth reconciliation balances.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-muted border border-border text-xs text-muted-foreground text-left space-y-2">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> Archived Audit Record
                </p>
                <p className="leading-relaxed">
                  This invoice was cancelled and is retained solely to maintain sequential numbering and audit trail
                  compliance. Cancelled records are immutable.
                </p>
              </div>
            )}

            <div className="flex justify-center gap-3 pt-2">
              <Button asChild variant="outline">
                <Link href="/invoices">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back to Invoices
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/invoices/${id}`}>View Invoice</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
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
  const totalPKR = total * Number(exchangeRate || 280.5);

  const handleSubmit = async (e: React.FormEvent, targetStatus?: string) => {
    e.preventDefault();
    setToast(null);
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
      setToast({
        type: "success",
        title: "Invoice Updated",
        message: `Changes to "${invoiceNumber || rawInvoice.invoiceNumber}" have been saved.`,
      });
      setTimeout(() => {
        router.push(`/invoices/${id}`);
      }, 800);
    } catch (err: any) {
      setToast({
        type: "error",
        title: "Could Not Update Invoice",
        message: apiErrorMessage(err, "Failed to update invoice."),
      });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Link href={`/invoices/${id}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground font-mono">
                Edit {rawInvoice.invoiceNumber}
              </h1>
              <Badge
                variant="outline"
                className={`capitalize text-xs font-semibold ${
                  currentStatus === "overdue"
                    ? "border-destructive/30 text-destructive bg-destructive/10"
                    : "border-blue-500/30 text-blue-500 bg-blue-500/10"
                }`}
              >
                {currentStatus}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isDraft
                ? "Draft invoice: all fields and invoice numbering can be customized before issuance."
                : "Issued invoice: line items, dates, and financial values can be adjusted with automatic server recalculation."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDraft && (
            <Button
              type="button"
              variant="outline"
              onClick={(e) => handleSubmit(e, "sent")}
              disabled={updateInvoiceMutation.isPending}
            >
              <Send className="mr-2 h-4 w-4" /> Save & Issue
            </Button>
          )}
          <Button
            type="button"
            onClick={(e) => handleSubmit(e)}
            disabled={updateInvoiceMutation.isPending}
          >
            {updateInvoiceMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isDraft ? "Save Draft" : "Save Changes"}
          </Button>
        </div>
      </div>

      {formError && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
        {/* Client & Header Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Invoice Details & Client Information
            </CardTitle>
            {!isDraft && (
              <CardDescription className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Lock className="h-3 w-3 text-muted-foreground" />
                Invoice number and client are locked on issued invoices to preserve fiscal audit records.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center justify-between">
                  <span>Client</span>
                  {!isDraft && <Lock className="h-3 w-3 text-muted-foreground" />}
                </label>
                {isDraft ? (
                  <select
                    value={clientId}
                    onChange={(e) => {
                      setClientId(e.target.value);
                      const selected = clients.find((c: any) => c.id === e.target.value);
                      if (selected) {
                        setClientName(selected.name);
                        setClientEmail(selected.email || "");
                        if (selected.currency) setCurrency(selected.currency);
                      }
                    }}
                    className="w-full h-10 px-3 rounded-md bg-background border border-input text-foreground text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="">Select or Enter Below...</option>
                    {clients.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.platform})
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={clientName}
                    disabled
                    className="bg-muted/40 border-input text-muted-foreground cursor-not-allowed"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Client Name</label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  disabled={!isDraft}
                  placeholder="Client / Company Name"
                  required
                  className={!isDraft ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Client Email</label>
                <Input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  disabled={!isDraft}
                  placeholder="billing@client.com"
                  className={!isDraft ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-border">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center justify-between">
                  <span>Invoice Number</span>
                  {!isDraft && <Lock className="h-3 w-3 text-muted-foreground" />}
                </label>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  disabled={!isDraft}
                  required
                  className={`font-mono ${!isDraft ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : "bg-background"}`}
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
                <label className="text-sm font-medium text-foreground">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-background border border-input text-foreground text-sm focus:border-primary focus:outline-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AED">AED (د.إ)</option>
                  <option value="SAR">SAR (﷼)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                  <option value="PKR">PKR (Rs)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">SBP Exchange Rate (PKR)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                  className="bg-background border-input text-foreground font-mono"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-foreground">Line Items</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Itemize tasks, milestones, or services provided.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex flex-col md:flex-row items-start md:items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border">
                <div className="flex-1 w-full">
                  <Input
                    placeholder="Description of service rendered..."
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    required
                    maxLength={500}
                    className="bg-background"
                  />
                </div>
                <div className="w-full md:w-28">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    required
                    className="bg-background font-mono text-center"
                  />
                </div>
                <div className="w-full md:w-36">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Rate"
                    value={item.rate}
                    onChange={(e) => updateItem(index, "rate", e.target.value)}
                    required
                    className="bg-background font-mono text-right"
                  />
                </div>
                <div className="w-full md:w-32 text-right font-mono font-bold text-foreground text-sm py-2 px-1">
                  {currency === "USD"
                    ? formatUSD(Number(item.quantity || 0) * Number(item.rate || 0))
                    : `${currency} ${(Number(item.quantity || 0) * Number(item.rate || 0)).toFixed(2)}`}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Totals and Notes Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold text-foreground">Remittance Notes & Payment Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Bank transfer instructions, IBAN details, or project completion notes..."
                rows={5}
                className="w-full p-3 rounded-lg bg-background border border-input text-foreground text-sm focus:border-primary focus:outline-none resize-none"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold text-foreground">Financial Calculation Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-foreground">
                  {currency === "USD" ? formatUSD(subtotal) : `${currency} ${subtotal.toFixed(2)}`}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Tax Rate (%):</span>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-28 h-8 text-right font-mono bg-background"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Discount ({currency}):</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="w-28 h-8 text-right font-mono bg-background"
                />
              </div>

              <div className="flex justify-between font-bold text-foreground pt-3 border-t border-border text-base">
                <span>Total Amount Due:</span>
                <span className="font-mono text-primary">
                  {currency === "USD" ? formatUSD(total) : `${currency} ${total.toFixed(2)}`}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 flex justify-between items-center text-xs mt-2">
                <span className="font-bold text-primary">Converted Home Income:</span>
                <span className="font-extrabold text-primary font-mono text-base">{formatPKR(totalPKR)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Bar */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button asChild variant="outline">
            <Link href={`/invoices/${id}`}>Cancel</Link>
          </Button>
          {isDraft && (
            <Button
              type="button"
              variant="outline"
              onClick={(e) => handleSubmit(e, "sent")}
              disabled={updateInvoiceMutation.isPending}
            >
              <Send className="mr-2 h-4 w-4" /> Save & Issue
            </Button>
          )}
          <Button type="submit" disabled={updateInvoiceMutation.isPending}>
            {updateInvoiceMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isDraft ? "Save Draft" : "Save Changes"}
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

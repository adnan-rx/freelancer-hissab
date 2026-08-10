"use client";

import { use, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Printer, CheckCircle2, ArrowLeft, Landmark, AlertTriangle, Loader2, Pencil, Lock } from "lucide-react";
import Link from "next/link";
import { formatPKR, formatUSD, apiErrorMessage } from "@/lib/utils";
import { useInvoice, useUpdateInvoiceStatus } from "@/hooks/use-invoices";
import { useProfile } from "@/hooks/use-profile";
import { useAuthStore } from "@/stores/auth.store";

import { Skeleton } from "@/components/ui/skeleton";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useAuthStore((state) => state.user);
  const { data: rawObj, isLoading, isError, error } = useInvoice(id);
  const { data: profile } = useProfile();
  const updateStatusMutation = useUpdateInvoiceStatus();

  useEffect(() => {
    if (rawObj?.invoiceNumber) {
      document.title = rawObj.invoiceNumber;
    }
    return () => {
      document.title = "FreelancerHisab - Financial OS for Pakistani Freelancers";
    };
  }, [rawObj?.invoiceNumber]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
        <Card className="border-border shadow-md rounded-2xl">
          <CardContent className="p-8 md:p-12 space-y-8">
            <div className="flex justify-between items-start border-b border-border pb-8">
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="h-8 w-32 ml-auto" />
                <Skeleton className="h-4 w-24 ml-auto" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8 py-2">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
            <Skeleton className="h-40 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // A missing or foreign invoice must say so rather than render fabricated placeholder data.
  if (isError || !rawObj) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-4">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-xl font-bold text-foreground">Invoice not found</h1>
        <p className="text-sm text-muted-foreground">
          {apiErrorMessage(error, "This invoice does not exist, or you do not have access to it.")}
        </p>
        <Button asChild variant="outline">
          <Link href="/invoices"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Invoices</Link>
        </Button>
      </div>
    );
  }

  const invoice = {
    id: rawObj.id,
    invoiceNumber: rawObj.invoiceNumber,
    clientName: rawObj.client?.name || "Direct Client",
    clientEmail: rawObj.client?.email || "",
    clientPlatform: rawObj.client?.platform || "direct",
    dueDate: rawObj.dueDate || null,
    createdAt: rawObj.createdAt ? new Date(rawObj.createdAt).toISOString().split("T")[0] : null,
    currency: rawObj.currency || "USD",
    exchangeRate: parseFloat(rawObj.exchangeRate || "1"),
    subtotal: parseFloat(rawObj.subtotal || "0"),
    taxRate: parseFloat(rawObj.taxRate || "0"),
    taxAmount: parseFloat(rawObj.taxAmount || "0"),
    discountAmount: parseFloat(rawObj.discountAmount || "0"),
    total: parseFloat(rawObj.total || "0"),
    totalPKR: parseFloat(rawObj.totalPKR || "0"),
    status: rawObj.status || "sent",
    notes: rawObj.notes || "",
    items: (Array.isArray(rawObj.items) ? rawObj.items : []).map((it: any) => ({
      description: it.description || "Service Item",
      quantity: parseFloat(it.quantity || "1"),
      rate: parseFloat(it.rate || "0"),
      amount: parseFloat(it.amount || (parseFloat(it.quantity || "1") * parseFloat(it.rate || "0")).toString()),
    })),
  };

  const handlePrint = () => {
    document.title = invoice.invoiceNumber;
    window.print();
  };

  const handleMarkAsPaid = () => {
    updateStatusMutation.mutate({ id: invoice.id, status: "paid" });
  };

  const currentStatus = invoice.status;
  const canEdit = currentStatus !== "paid" && currentStatus !== "cancelled";
  const bankName = profile?.bankName;
  const iban = profile?.iban;
  const businessName = profile?.businessName || user?.businessName;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 print:p-0 print:m-0 print:max-w-none print:w-full">
      {/* Action Bar (Hidden during PDF print) */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Link href="/invoices"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">{invoice.invoiceNumber}</h1>
              <Badge
                variant="outline"
                className={`capitalize text-xs font-semibold ${
                  currentStatus === "paid"
                    ? "border-primary/40 text-primary bg-primary/10"
                    : currentStatus === "cancelled"
                    ? "border-muted-foreground/40 text-muted-foreground bg-muted"
                    : "border-blue-500/40 text-blue-500 bg-blue-500/10"
                }`}
              >
                {currentStatus}
              </Badge>
              {!canEdit && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3 text-muted-foreground/70" />
                  {currentStatus === "paid" ? "Locked (Paid)" : "Archived (Cancelled)"}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Issued to {invoice.clientName}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {canEdit && (
            <Button asChild variant="outline" className="border-border hover:bg-muted text-foreground">
              <Link href={`/invoices/${invoice.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" /> Edit Invoice
              </Link>
            </Button>
          )}
          {currentStatus !== "paid" && currentStatus !== "cancelled" && (
            <Button
              onClick={handleMarkAsPaid}
              variant="outline"
              disabled={updateStatusMutation.isPending}
              className="border-primary/30 text-primary hover:bg-primary/10"
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Mark as Paid
            </Button>
          )}
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Export PDF / Print
          </Button>
        </div>
      </div>

      {updateStatusMutation.isError && (
        <div className="print:hidden p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {apiErrorMessage(updateStatusMutation.error, "Could not mark this invoice as paid.")}
        </div>
      )}

      {/* Printable Invoice Document Canvas */}
      <Card className="print:shadow-none print:border-none print:m-0 print:p-0 bg-background text-foreground border-border shadow-xl overflow-hidden rounded-2xl print:w-full">
        <CardContent className="p-8 md:p-12 space-y-8 print:p-6">
          {/* Document Header */}
          <div className="flex justify-between items-start border-b border-border pb-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                  Rs
                </div>
                <span className="text-2xl font-extrabold tracking-tight text-foreground">
                  Freelancer<span className="text-primary">Hisab</span>
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground pt-2">{user?.name}</p>
              {businessName && <p className="text-xs text-muted-foreground">{businessName}</p>}
              {user?.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
            </div>

            <div className="text-right space-y-1">
              <span className="text-3xl font-black tracking-tight text-foreground uppercase">INVOICE</span>
              <p className="text-sm font-mono font-bold text-primary">{invoice.invoiceNumber}</p>
              <div className="pt-2 text-xs text-muted-foreground space-y-0.5">
                <p><span className="font-semibold text-foreground">Date Issued:</span> {invoice.createdAt || "—"}</p>
                <p><span className="font-semibold text-foreground">Due Date:</span> {invoice.dueDate || "—"}</p>
                <p><span className="font-semibold text-foreground">SBP Exchange Rate:</span> 1 {invoice.currency} = {invoice.exchangeRate} PKR</p>
              </div>
            </div>
          </div>

          {/* Billed To Section */}
          <div className="grid grid-cols-2 gap-8 py-2">
            <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Billed To Client:</span>
              <p className="text-base font-bold text-foreground">{invoice.clientName}</p>
              {invoice.clientEmail && <p className="text-xs text-muted-foreground">{invoice.clientEmail}</p>}
              <p className="text-xs text-muted-foreground font-medium capitalize">Platform: {invoice.clientPlatform}</p>
            </div>

            <div className="bg-muted/30 p-4 rounded-xl border border-border flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Payment Status:</span>
                <div className="mt-1">
                  {currentStatus === "paid" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                      <CheckCircle2 className="h-3.5 w-3.5" /> PAID IN FULL
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-xs font-bold border border-blue-500/20">
                      PAYMENT PENDING
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Base Remittance Currency: <span className="font-bold text-foreground">{invoice.currency}</span></p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-foreground font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Service Description</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Rate</th>
                  <th className="py-3 px-4 text-right">Amount ({invoice.currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground font-medium">
                {invoice.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 px-4 text-center text-muted-foreground">No line items on this invoice.</td>
                  </tr>
                ) : (
                  invoice.items.map((item: (typeof invoice.items)[number], i: number) => (
                    <tr key={i}>
                      <td className="py-3.5 px-4 font-semibold text-foreground">{item.description}</td>
                      <td className="py-3.5 px-4 text-center">{item.quantity}</td>
                      <td className="py-3.5 px-4 text-right font-mono">{invoice.currency === "USD" ? formatUSD(item.rate) : item.rate.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold">{invoice.currency === "USD" ? formatUSD(item.amount) : item.amount.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Total Calculation Summary */}
          <div className="flex flex-col md:flex-row justify-between items-start pt-4 gap-6">
            <div className="flex-1 space-y-3 bg-muted/30 p-4 rounded-xl border border-border text-xs text-muted-foreground">
              <div className="font-bold text-foreground flex items-center gap-1.5">
                <Landmark className="h-4 w-4 text-primary" /> Remittance Instructions
              </div>
              {invoice.notes && <p className="leading-relaxed">{invoice.notes}</p>}
              {bankName || iban ? (
                <div className="text-[11px] text-muted-foreground border-t border-border pt-2 font-mono">
                  {bankName && <span>{bankName}</span>}
                  {bankName && iban && <span> · </span>}
                  {iban && <span>IBAN: {iban}</span>}
                </div>
              ) : (
                <p className="text-[11px] text-amber-600 border-t border-border pt-2">
                  Add your bank name and IBAN in Settings → Bank & SBP Tax to show remittance details here.
                </p>
              )}
            </div>

            <div className="w-full md:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-foreground">{invoice.currency === "USD" ? formatUSD(invoice.subtotal) : invoice.subtotal.toFixed(2)}</span>
              </div>
              {invoice.taxAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({invoice.taxRate}%):</span>
                  <span className="font-mono text-foreground">{invoice.currency === "USD" ? formatUSD(invoice.taxAmount) : invoice.taxAmount.toFixed(2)}</span>
                </div>
              )}
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount:</span>
                  <span className="font-mono text-foreground">-{invoice.currency === "USD" ? formatUSD(invoice.discountAmount) : invoice.discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between font-bold text-foreground text-sm pt-2 border-t border-border">
                <span>Total Amount Due:</span>
                <span className="font-mono text-primary text-base">{invoice.currency === "USD" ? formatUSD(invoice.total) : `${invoice.currency} ${invoice.total.toFixed(2)}`}</span>
              </div>

              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex justify-between items-center text-xs mt-3">
                <span className="font-bold text-primary">Converted Home Income:</span>
                <span className="font-extrabold text-primary font-mono text-base">{formatPKR(invoice.totalPKR)}</span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
            Generated via FreelancerHisab — Financial Operating System for Pakistani Freelancers
          </div>
        </CardContent>
      </Card>

      {/* Global CSS Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          aside, header, nav, button, .print\\:hidden {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            visibility: hidden !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
}

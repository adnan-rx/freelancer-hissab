"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Landmark, Loader2, Lock, Pencil, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceStatusBadge } from "@/components/ui/status-badge";
import { Logo } from "@/components/layout/logo";
import { formatPKR, formatMoney, formatDate, apiErrorMessage } from "@/lib/utils";
import { useInvoice, useUpdateInvoiceStatus } from "@/hooks/use-invoices";
import { useProfile } from "@/hooks/use-profile";
import { useAuthStore } from "@/stores/auth.store";
import { useToast } from "@/providers/toast-provider";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useAuthStore((state) => state.user);
  const { data: rawObj, isLoading, isError, error } = useInvoice(id);
  const { data: profile } = useProfile();
  const updateStatusMutation = useUpdateInvoiceStatus();
  const { showSuccess } = useToast();

  useEffect(() => {
    if (rawObj?.invoiceNumber) {
      document.title = rawObj.invoiceNumber;
    }
    return () => {
      document.title = "FreelancerHisab — Financial OS for Pakistani Freelancers";
    };
  }, [rawObj?.invoiceNumber]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[36rem] rounded-lg" />
      </div>
    );
  }

  // A missing or foreign invoice must say so rather than render fabricated placeholder data.
  if (isError || !rawObj) {
    return (
      <Card className="mx-auto max-w-lg">
        <ErrorState
          title="Invoice not found"
          description={apiErrorMessage(error, "This invoice doesn't exist, or you don't have access to it.")}
          action={
            <Button asChild variant="outline">
              <Link href="/invoices">Back to invoices</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  const invoice = {
    id: rawObj.id,
    invoiceNumber: rawObj.invoiceNumber,
    clientName: rawObj.client?.name || "Direct client",
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
      description: it.description || "Service item",
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
    // A failure is already surfaced by the global mutation error toast; this
    // adds the success confirmation that was previously missing entirely —
    // the button used to do this with zero feedback either way.
    updateStatusMutation.mutate(
      { id: invoice.id, status: "paid" },
      { onSuccess: () => showSuccess(`Invoice ${invoice.invoiceNumber} marked as paid.`, "Invoice paid") },
    );
  };

  const currentStatus = invoice.status;
  const canEdit = currentStatus !== "paid" && currentStatus !== "cancelled";
  const bankName = profile?.bankName;
  const iban = profile?.iban;
  const businessName = profile?.businessName || user?.businessName;
  const money = (value: number) =>
    formatMoney(value, invoice.currency);

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:m-0 print:max-w-none print:p-0">
      <div className="print:hidden">
        <PageHeader
          backHref="/invoices"
          backLabel="All invoices"
          title={invoice.invoiceNumber}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <InvoiceStatusBadge status={currentStatus} />
              <span>Issued to {invoice.clientName}</span>
              {!canEdit && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3" aria-hidden="true" />
                  {currentStatus === "paid" ? "Locked once paid" : "Archived"}
                </span>
              )}
            </span>
          }
          actions={
            <>
              {canEdit && (
                <Button asChild variant="outline">
                  <Link href={`/invoices/${invoice.id}/edit`}>
                    <Pencil /> Edit
                  </Link>
                </Button>
              )}
              {canEdit && (
                <Button onClick={handleMarkAsPaid} variant="secondary" disabled={updateStatusMutation.isPending}>
                  {updateStatusMutation.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  Mark as paid
                </Button>
              )}
              <Button onClick={handlePrint}>
                <Printer /> Export PDF
              </Button>
            </>
          }
        />
      </div>

      {updateStatusMutation.isError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/15 bg-destructive-surface p-3 text-sm text-destructive print:hidden"
        >
          {apiErrorMessage(updateStatusMutation.error, "Could not mark this invoice as paid.")}
        </div>
      )}

      {/* The printable document */}
      <Card className="overflow-hidden shadow-md print:m-0 print:w-full print:rounded-none print:border-none print:shadow-none">
        <CardContent className="space-y-8 p-6 pt-6 sm:p-10 sm:pt-10 print:p-8">
          {/* Deliberately a div, not <header>: the print rules below hide every
              <header> on the page, which would blank the invoice's own masthead. */}
          <div className="flex flex-col gap-6 border-b border-border pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <Logo />
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{user?.name}</p>
                {businessName && <p className="text-sm text-muted-foreground">{businessName}</p>}
                {user?.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
              </div>
            </div>

            <div className="space-y-2 sm:text-right">
              <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Invoice</p>
              <p className="font-mono text-xl font-semibold tracking-[-0.01em] text-foreground">{invoice.invoiceNumber}</p>
              <dl className="space-y-0.5 text-xs text-muted-foreground">
                <div className="flex gap-2 sm:justify-end">
                  <dt>Issued</dt>
                  <dd className="font-medium tabular text-foreground">
                    {invoice.createdAt ? formatDate(invoice.createdAt) : "—"}
                  </dd>
                </div>
                <div className="flex gap-2 sm:justify-end">
                  <dt>Due</dt>
                  <dd className="font-medium tabular text-foreground">
                    {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                  </dd>
                </div>
                <div className="flex gap-2 sm:justify-end">
                  <dt>Rate</dt>
                  <dd className="font-mono font-medium tabular-nums text-foreground">
                    1 {invoice.currency} = {invoice.exchangeRate} PKR
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-muted/40 p-4">
              <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Billed to</p>
              <p className="mt-2 text-sm font-medium text-foreground">{invoice.clientName}</p>
              {invoice.clientEmail && <p className="text-sm text-muted-foreground">{invoice.clientEmail}</p>}
              <p className="mt-1 text-xs capitalize text-muted-foreground">via {invoice.clientPlatform}</p>
            </div>

            <div className="flex flex-col justify-between rounded-md border border-border bg-muted/40 p-4">
              <div>
                <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Payment status</p>
                <div className="mt-2">
                  <InvoiceStatusBadge status={currentStatus} />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Settled in <span className="font-medium text-foreground">{invoice.currency}</span>
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-border">
            <div className="overflow-x-auto thin-scrollbar">
              <table className="w-full min-w-[30rem] text-left text-sm">
                <thead className="border-b border-border bg-muted/60">
                  <tr>
                    <th className="px-4 py-2.5 text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Description
                    </th>
                    <th className="px-4 py-2.5 text-center text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Qty
                    </th>
                    <th className="px-4 py-2.5 text-right text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Rate
                    </th>
                    <th className="px-4 py-2.5 text-right text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoice.items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No line items on this invoice.
                      </td>
                    </tr>
                  ) : (
                    invoice.items.map((item: (typeof invoice.items)[number], i: number) => (
                      <tr key={i}>
                        <td className="px-4 py-3 font-medium text-foreground">{item.description}</td>
                        <td className="px-4 py-3 text-center tabular text-muted-foreground">{item.quantity}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                          {money(item.rate)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-foreground">
                          {money(item.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex-1 space-y-2.5 rounded-md border border-border bg-muted/40 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Landmark className="size-4 text-brand-600" aria-hidden="true" /> Remittance instructions
              </p>
              {invoice.notes && <p className="text-sm leading-relaxed text-muted-foreground">{invoice.notes}</p>}
              {bankName || iban ? (
                <p className="border-t border-border pt-2.5 font-mono text-xs text-muted-foreground">
                  {bankName}
                  {bankName && iban && " · "}
                  {iban && `IBAN ${iban}`}
                </p>
              ) : (
                <p className="border-t border-border pt-2.5 text-xs leading-relaxed text-warning">
                  Add your bank name and IBAN in Settings → Bank &amp; tax and they&apos;ll appear here.
                </p>
              )}
            </div>

            <dl className="w-full space-y-2 md:w-72">
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-mono font-medium tabular-nums text-foreground">{money(invoice.subtotal)}</dd>
              </div>
              {invoice.taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">Tax ({invoice.taxRate}%)</dt>
                  <dd className="font-mono tabular-nums text-foreground">{money(invoice.taxAmount)}</dd>
                </div>
              )}
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="font-mono tabular-nums text-foreground">−{money(invoice.discountAmount)}</dd>
                </div>
              )}

              <div className="flex justify-between border-t border-border pt-2.5 text-sm">
                <dt className="font-medium text-foreground">Total due</dt>
                <dd className="font-mono text-base font-semibold tabular-nums text-foreground">{money(invoice.total)}</dd>
              </div>

              <div className="flex items-center justify-between rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5">
                <dt className="text-sm font-medium text-brand-800">In PKR</dt>
                <dd className="font-mono text-base font-semibold tabular-nums text-brand-900">
                  {formatPKR(invoice.totalPKR)}
                </dd>
              </div>
            </dl>
          </div>

          <p className="border-t border-border pt-6 text-center text-xs text-subtle">
            Generated with FreelancerHisab
          </p>
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

"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Printer, Download, CheckCircle2, ArrowLeft, Building2, ShieldCheck, Landmark } from "lucide-react";
import Link from "next/link";
import { formatPKR, formatUSD } from "@/lib/utils";
import { useInvoice } from "@/hooks/use-invoices";
import { useAuthStore } from "@/stores/auth.store";
import { apiClient } from "@/lib/api-client";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { data: invoiceData, isLoading } = useInvoice(id);

  const [paidStatus, setPaidStatus] = useState<string | null>(null);

  // Real invoice record mapped dynamically from database response
  const rawObj = invoiceData?.data || invoiceData;
  const invoice = {
    id: rawObj?.id || id,
    invoiceNumber: rawObj?.invoiceNumber || rawObj?.invoice_number || id,
    clientName: rawObj?.client?.name || rawObj?.clientName || "Direct Client",
    clientEmail: rawObj?.client?.email || rawObj?.clientEmail || "",
    clientPlatform: rawObj?.client?.platform || "Upwork / Direct",
    dueDate: rawObj?.dueDate || rawObj?.due_date || new Date().toISOString().split("T")[0],
    createdAt: rawObj?.createdAt ? new Date(rawObj.createdAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    currency: rawObj?.currency || "USD",
    exchangeRate: parseFloat(rawObj?.exchangeRate || rawObj?.exchange_rate || "280.50"),
    subtotal: parseFloat(rawObj?.subtotal || "0"),
    taxRate: parseFloat(rawObj?.taxRate || rawObj?.tax_rate || "0"),
    taxAmount: parseFloat(rawObj?.taxAmount || rawObj?.tax_amount || "0"),
    discountAmount: parseFloat(rawObj?.discountAmount || rawObj?.discount_amount || "0"),
    total: parseFloat(rawObj?.total || "0"),
    totalPKR: parseFloat(rawObj?.totalPKR || rawObj?.total_pkr || "0"),
    status: paidStatus || rawObj?.status || "sent",
    notes: rawObj?.notes || "Wire foreign remittance directly to Meezan Bank IBAN under SBP Purpose Code 9100 for tax exemption.",
    items: Array.isArray(rawObj?.items) && rawObj.items.length > 0 
      ? rawObj.items.map((it: any) => ({
          description: it.description || "Service Item",
          quantity: parseFloat(it.quantity || "1"),
          rate: parseFloat(it.rate || "0"),
          amount: parseFloat(it.amount || (parseFloat(it.quantity || "1") * parseFloat(it.rate || "0")).toString()),
        }))
      : [
          { description: "Full Stack Web Application Development & API Integration", quantity: 1, rate: parseFloat(rawObj?.total || "1000"), amount: parseFloat(rawObj?.total || "1000") },
        ],
  };

  // Automatically set document.title to invoice number so "Save as PDF" defaults to invoice number filename
  useEffect(() => {
    const invNum = invoice?.invoiceNumber || id;
    if (invNum) {
      document.title = `${invNum}`;
    }
    return () => {
      document.title = "FreelancerHisab - Financial OS for Pakistani Freelancers";
    };
  }, [invoice?.invoiceNumber, id]);

  const handlePrint = () => {
    const invNum = invoice?.invoiceNumber || id;
    if (invNum) {
      document.title = `${invNum}`;
    }
    window.print();
  };

  const handleMarkAsPaid = async () => {
    setPaidStatus("paid");
    try {
      await apiClient.patch(`/invoices/${invoice.id}/status`, { status: "paid" });
    } catch (e) {
      console.warn("API status update failed, set paid locally:", e);
    }
  };

  const currentStatus = paidStatus || invoice.status;

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
                    : "border-blue-500/40 text-blue-500 bg-blue-500/10"
                }`}
              >
                {currentStatus}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Issued to {invoice.clientName || "Client"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentStatus !== "paid" && (
            <Button onClick={handleMarkAsPaid} variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as Paid
            </Button>
          )}
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Export PDF / Print
          </Button>
        </div>
      </div>

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
              <p className="text-sm font-semibold text-foreground pt-2">{user?.name || "Ahmed Ali"}</p>
              <p className="text-xs text-muted-foreground">{user?.businessName || "Ahmed Web Solutions"}</p>
              <p className="text-xs text-muted-foreground">Lahore, Punjab, Pakistan 54000</p>
              <p className="text-xs text-muted-foreground">{user?.email || "ahmed.dev@example.com"}</p>
            </div>

            <div className="text-right space-y-1">
              <span className="text-3xl font-black tracking-tight text-foreground uppercase">INVOICE</span>
              <p className="text-sm font-mono font-bold text-primary">{invoice.invoiceNumber}</p>
              <div className="pt-2 text-xs text-muted-foreground space-y-0.5">
                <p><span className="font-semibold text-foreground">Date Issued:</span> {invoice.createdAt ? String(invoice.createdAt).substring(0, 10) : "2026-08-01"}</p>
                <p><span className="font-semibold text-foreground">Due Date:</span> {invoice.dueDate || "2026-08-15"}</p>
                <p><span className="font-semibold text-foreground">SBP Exchange Rate:</span> 1 {invoice.currency} = {invoice.exchangeRate || 280.50} PKR</p>
              </div>
            </div>
          </div>

          {/* Billed To Section */}
          <div className="grid grid-cols-2 gap-8 py-2">
            <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Billed To Client:</span>
              <p className="text-base font-bold text-foreground">{invoice.clientName}</p>
              <p className="text-xs text-muted-foreground">{invoice.clientEmail}</p>
              <p className="text-xs text-muted-foreground font-medium">Platform: {invoice.clientPlatform || "Upwork Escrow"}</p>
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
                {invoice.items?.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="py-3.5 px-4 font-semibold text-foreground">{item.description}</td>
                    <td className="py-3.5 px-4 text-center">{item.quantity}</td>
                    <td className="py-3.5 px-4 text-right font-mono">{invoice.currency === "USD" ? formatUSD(item.rate) : item.rate}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold">{invoice.currency === "USD" ? formatUSD(item.amount || (item.quantity * item.rate)) : (item.quantity * item.rate).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total Calculation Summary */}
          <div className="flex flex-col md:flex-row justify-between items-start pt-4 gap-6">
            <div className="flex-1 space-y-3 bg-muted/30 p-4 rounded-xl border border-border text-xs text-muted-foreground">
              <div className="font-bold text-foreground flex items-center gap-1.5">
                <Landmark className="h-4 w-4 text-primary" /> SBP Inward Remittance Instructions
              </div>
              <p className="leading-relaxed">
                {invoice.notes}
              </p>
              <div className="text-[11px] text-muted-foreground border-t border-border pt-2 font-mono">
                Meezan Bank IBAN: PK36MEZN0001020304050607 | SWIFT: MEZNPKKA
              </div>
            </div>

            <div className="w-full md:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-foreground">{invoice.currency === "USD" ? formatUSD(invoice.subtotal) : invoice.subtotal}</span>
              </div>
              {Number(invoice.taxAmount) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({invoice.taxRate}%):</span>
                  <span className="font-mono text-foreground">{formatUSD(invoice.taxAmount)}</span>
                </div>
              )}
              {Number(invoice.discountAmount) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount:</span>
                  <span className="font-mono text-foreground">-{formatUSD(invoice.discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between font-bold text-foreground text-sm pt-2 border-t border-border">
                <span>Total Amount Due:</span>
                <span className="font-mono text-primary text-base">{invoice.currency === "USD" ? formatUSD(invoice.total) : `${invoice.currency} ${invoice.total}`}</span>
              </div>

              {/* PKR Conversion Highlight Box */}
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

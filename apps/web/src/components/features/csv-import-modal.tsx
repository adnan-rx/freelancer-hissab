"use client";

import { useState, useRef } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  Receipt,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import { apiErrorMessage, formatPKR, formatMoney, unwrapApi } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface CSVPreviewItem {
  externalId: string;
  date: string;
  type: "income" | "expense";
  description: string;
  counterparty: string;
  currency: string;
  amount: number;
  amountPKR: number;
  /** Already in the ledger — shown greyed out and excluded from the totals. */
  isDuplicate: boolean;
}

export interface CSVPreviewData {
  detectedPlatform: "upwork" | "fiverr" | "freelancer" | "toptal" | "generic";
  totalRows: number;
  incomeCount: number;
  expenseCount: number;
  duplicateCount: number;
  newInvoiceCount: number;
  newClients: string[];
  existingClients: string[];
  /** Per source currency, so a mixed-currency statement is not misreported. */
  currencyTotals: Array<{ currency: string; gross: number; fees: number; net: number }>;
  grossTotalPKR: number;
  feesTotalPKR: number;
  netTotalPKR: number;
  skippedRows: number;
  invalidDateRows: number;
  previewItems: CSVPreviewItem[];
  warnings: string[];
}

/** Renders "1,200.00 USD · 650.00 EUR" for a statement that mixes currencies. */
function formatCurrencyTotals(
  totals: CSVPreviewData["currencyTotals"],
  field: "gross" | "fees" | "net",
): string {
  if (totals.length === 0) return "—";
  return totals.map((t) => `${t[field].toFixed(2)} ${t.currency}`).join(" · ");
}

export function CSVImportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<string>("all");
  const [dragActive, setDragActive] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedSuccess, setImportedSuccess] = useState(false);
  const [importStats, setImportStats] = useState<{
    totalParsed: number;
    incomeCount: number;
    expenseCount: number;
    clientsCreated: number;
    invoicesCreated: number;
    platform: string;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stored active file or text payload for preview & final import
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCsvText, setSelectedCsvText] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<CSVPreviewData | null>(null);
  const [exchangeRateOverride, setExchangeRateOverride] = useState<string>("");

  const SAMPLE_UPWORK_CSV = `Date,Ref ID,Type,Description,Agency,Amount,Balance
08/01/2026,98123741,Hourly,"Invoice for TechFlow Labs - Sprint 1 Fullstack Engineering",,1450.00,1450.00
08/01/2026,98123742,Service Fee,"Service Fee for TechFlow Labs - Sprint 1 Fullstack Engineering",,-145.00,1305.00
08/03/2026,98123743,Fixed Price,"Milestone Payment from Acme Corp - Mobile App API",,850.00,2155.00
08/03/2026,98123744,Service Fee,"Service Fee for Acme Corp - Mobile App API",,-85.00,2070.00
08/05/2026,98123745,Fixed Price,"Milestone Payment from Horizon Media - UI UX Redesign",,1200.00,3270.00
08/05/2026,98123746,Service Fee,"Service Fee for Horizon Media - UI UX Redesign",,-120.00,3150.00`;

  const SAMPLE_FIVERR_CSV = `Date,Order ID,Item Description,Buyer,Gross Amount,Service Fee,Net Amount,Status
08/02/2026,FO18293741,"Fullstack Next.js SaaS MVP Development",design_studio,1200.00,-240.00,960.00,Cleared
08/04/2026,FO18293742,"Custom REST API Integration & Auth Module",pixel_craft,650.00,-130.00,520.00,Cleared
08/06/2026,FO18293743,"Mobile App UI/UX Figma Design System",nordic_apps,800.00,-160.00,640.00,Cleared
08/08/2026,FO18293744,"Database Optimization & SQL Performance Tuning",speed_tech,450.00,-90.00,360.00,Cleared`;

  const validateFile = (file: File): string | null => {
    const isCSVExtension = file.name.toLowerCase().endsWith(".csv");
    const isCSVMime =
      file.type === "text/csv" ||
      file.type === "application/vnd.ms-excel" ||
      file.type === "text/plain" ||
      file.type === "";

    if (!isCSVExtension || !isCSVMime) {
      return `"${file.name}" isn't a CSV file. Upload a .csv statement instead.`;
    }

    if (file.size === 0) {
      return `That file is empty. Upload a statement with transaction rows in it.`;
    }

    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `That file is over the ${MAX_SIZE_MB}MB limit. Split the statement or export a shorter range.`;
    }

    return null;
  };

  /**
   * Phase 1: Dry-Run Preview Request
   */
  const handlePreview = async (file?: File, csvText?: string, rate?: string) => {
    setErrorMessage(null);

    if (file) {
      const validationError = validateFile(file);
      if (validationError) {
        setErrorMessage(validationError);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setSelectedFile(file);
      setSelectedCsvText(null);
    } else if (csvText) {
      setSelectedCsvText(csvText);
      setSelectedFile(null);
    }

    setPreviewing(true);

    try {
      let res;
      const platformHint = activeTab !== "all" ? activeTab : undefined;

      if (file || selectedFile) {
        const targetFile = file || selectedFile!;
        const formData = new FormData();
        formData.append("file", targetFile);
        if (rate || exchangeRateOverride) {
          formData.append("exchangeRate", rate || exchangeRateOverride);
        }
        if (platformHint) {
          formData.append("platform", platformHint);
        }
        res = await apiClient.post("/csv/preview", formData);
      } else if (csvText || selectedCsvText) {
        res = await apiClient.post("/csv/preview", {
          csvText: csvText || selectedCsvText,
          exchangeRate: rate || exchangeRateOverride || undefined,
          platform: platformHint,
        });
      } else {
        throw new Error("No file or CSV text supplied for preview");
      }

      const data = unwrapApi<CSVPreviewData>(res);
      setPreviewData(data);
    } catch (err: unknown) {
      setErrorMessage(apiErrorMessage(err, "Failed to parse and preview statement."));
      setPreviewData(null);
    } finally {
      setPreviewing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /**
   * Phase 2: Final Commit & Import
   */
  const handleConfirmImport = async () => {
    if (!selectedFile && !selectedCsvText) return;
    setErrorMessage(null);
    setImporting(true);

    try {
      let res;
      const platformHint = previewData?.detectedPlatform || (activeTab !== "all" ? activeTab : undefined);

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        if (exchangeRateOverride) {
          formData.append("exchangeRate", exchangeRateOverride);
        }
        if (platformHint) {
          formData.append("platform", platformHint);
        }
        res = await apiClient.post("/csv/import", formData);
      } else if (selectedCsvText) {
        res = await apiClient.post("/csv/import", {
          csvText: selectedCsvText,
          exchangeRate: exchangeRateOverride || undefined,
          platform: platformHint,
        });
      }

      if (!res) throw new Error("No CSV file or text was selected.");

      const data = unwrapApi<{
        totalParsed?: number;
        incomeCount?: number;
        expenseCount?: number;
        clientsCreated?: number;
        invoicesCreated?: number;
        platform?: string;
      }>(res);

      setImportStats({
        totalParsed: data?.totalParsed || 0,
        incomeCount: data?.incomeCount || 0,
        expenseCount: data?.expenseCount || 0,
        clientsCreated: data?.clientsCreated || 0,
        invoicesCreated: data?.invoicesCreated || 0,
        platform: data?.platform || "platform",
      });

      setImportedSuccess(true);

      // Invalidate queries so all screens update immediately
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["filing-readiness"] });
      queryClient.invalidateQueries({ queryKey: ["tax-estimate"] });
      queryClient.invalidateQueries({ queryKey: ["report-income-vs-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["report-income-consolidation"] });
    } catch (err: unknown) {
      setErrorMessage(apiErrorMessage(err, "Failed to execute statement import."));
    } finally {
      setImporting(false);
    }
  };

  const downloadSample = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handlePreview(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePreview(e.dataTransfer.files[0]);
    }
  };

  const handleClose = () => {
    setImportedSuccess(false);
    setErrorMessage(null);
    setPreviewData(null);
    setSelectedFile(null);
    setSelectedCsvText(null);
    setImportStats(null);
    setExchangeRateOverride("");
    onClose();
  };

  const getPlatformBadge = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case "upwork":
        return <Badge variant="success">Upwork Statement</Badge>;
      case "fiverr":
        return <Badge variant="info">Fiverr Statement</Badge>;
      default:
        return <Badge variant="neutral">Generic Statement</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className={cn("transition-all duration-200", previewData ? "sm:max-w-4xl" : "sm:max-w-xl")}>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />

        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Import from Freelance Platforms</DialogTitle>
            {previewData && getPlatformBadge(previewData.detectedPlatform)}
          </div>
          <DialogDescription>
            Directly import clients, gross earnings, invoices, and platform commission fees from Upwork, Fiverr, or standard statements.
          </DialogDescription>
        </DialogHeader>

        {importedSuccess && importStats ? (
          <>
            <DialogBody className="space-y-6">
              <div className="flex flex-col items-center py-6 text-center">
                <span
                  className="flex size-14 items-center justify-center rounded-full bg-success-surface text-success ring-8 ring-success/10"
                  aria-hidden="true"
                >
                  <CheckCircle2 className="size-7" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-foreground">
                  Statement Successfully Imported
                </h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  All records were reconciled and linked to your clients, invoices, and ledger.
                </p>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-card p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground">Income Records</p>
                  <p className="mt-1 text-xl font-bold text-foreground tabular-nums">
                    {importStats.incomeCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground">Platform Fees</p>
                  <p className="mt-1 text-xl font-bold text-foreground tabular-nums">
                    {importStats.expenseCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground">Invoices Generated</p>
                  <p className="mt-1 text-xl font-bold text-foreground tabular-nums">
                    {importStats.invoicesCreated}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground">Clients Created</p>
                  <p className="mt-1 text-xl font-bold text-foreground tabular-nums">
                    {importStats.clientsCreated}
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-brand-200 bg-brand-50/50 p-3 text-xs text-brand-900">
                <div className="flex items-start gap-2">
                  <Sparkles className="size-4 shrink-0 text-brand-600 mt-0.5" />
                  <div>
                    <span className="font-medium">Automatic Tax & Export Classification:</span> All foreign earnings from {importStats.platform.toUpperCase()} have been tagged under SBP Purpose Code <strong>9100 (IT Export Services)</strong> for final tax regime calculation (0.25% PSEB / 1% Standard rate).
                  </div>
                </div>
              </div>
            </DialogBody>
            <DialogFooter className="flex flex-wrap items-center justify-between gap-2 sm:justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild onClick={handleClose}>
                  <Link href="/clients">
                    <Users className="size-4 mr-1" /> View Clients
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild onClick={handleClose}>
                  <Link href="/invoices">
                    <Receipt className="size-4 mr-1" /> View Invoices
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild onClick={handleClose}>
                  <Link href="/transactions">
                    <Briefcase className="size-4 mr-1" /> View Ledger
                  </Link>
                </Button>
              </div>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : previewData ? (
          /* =========================================================================
             PREVIEW & CONFIRMATION SCREEN
             ========================================================================= */
          <>
            <DialogBody className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-md border border-destructive/15 bg-destructive-surface p-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              {/* Top Financial Breakdown Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/40 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Gross Earnings</span>
                    <Badge variant="neutral" className="text-[10px] uppercase">
                      {previewData.incomeCount} orders/milestones
                    </Badge>
                  </div>
                  <div className="mt-2 text-lg font-bold text-foreground tabular-nums">
                    {formatPKR(previewData.grossTotalPKR)}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {formatCurrencyTotals(previewData.currencyTotals, "gross")}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/40 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Platform Fees</span>
                    <Badge variant="destructive" className="text-[10px] uppercase">
                      {previewData.expenseCount} fee deductions
                    </Badge>
                  </div>
                  <div className="mt-2 text-lg font-bold text-destructive tabular-nums">
                    -{formatPKR(previewData.feesTotalPKR)}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    -{formatCurrencyTotals(previewData.currencyTotals, "fees")}
                  </div>
                </div>

                <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-brand-900">Net Remittance</span>
                    <span className="text-[10px] font-medium text-brand-700">Bank Inflow</span>
                  </div>
                  <div className="mt-2 text-lg font-bold text-brand-900 tabular-nums">
                    {formatPKR(previewData.netTotalPKR)}
                  </div>
                  <div className="text-xs text-brand-700 font-medium tabular-nums">
                    {formatCurrencyTotals(previewData.currencyTotals, "net")}
                  </div>
                </div>
              </div>

              {/* Extracted Clients & Invoices Summary */}
              <div className="rounded-lg border border-border p-4 bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Entities Detected in Statement
                  </h4>
                  <span className="text-xs text-muted-foreground font-mono">
                    {previewData.newInvoiceCount} Invoices to generate
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground mr-1">Clients:</span>
                  {previewData.newClients.map((client) => (
                    <Badge key={client} variant="info" className="gap-1 text-xs">
                      <Users className="size-3" /> {client} (New)
                    </Badge>
                  ))}
                  {previewData.existingClients.map((client) => (
                    <Badge key={client} variant="neutral" className="gap-1 text-xs">
                      <Users className="size-3" /> {client} (Matched)
                    </Badge>
                  ))}
                  {previewData.newClients.length === 0 && previewData.existingClients.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No client names parsed</span>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Parsed Transactions Preview (First {previewData.previewItems.length} rows)
                  </h4>
                </div>

                <div className="rounded-md border border-border overflow-hidden">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="py-2">Date</TableHead>
                        <TableHead className="py-2">Type</TableHead>
                        <TableHead className="py-2">Client / Vendor</TableHead>
                        <TableHead className="py-2">Description</TableHead>
                        <TableHead className="py-2 text-right">Amount</TableHead>
                        <TableHead className="py-2 text-right">Amount (PKR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.previewItems.map((item) => (
                        <TableRow
                          key={`${item.externalId}-${item.type}`}
                          className={cn(item.isDuplicate && "opacity-50")}
                        >
                          <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                            {item.date}
                          </TableCell>
                          <TableCell>
                            {item.isDuplicate ? (
                              <Badge variant="neutral" className="text-[10px] px-1.5 py-0">
                                Already imported
                              </Badge>
                            ) : item.type === "income" ? (
                              <Badge variant="success" className="text-[10px] px-1.5 py-0">
                                Gross Income
                              </Badge>
                            ) : (
                              <Badge variant="neutral" className="text-[10px] px-1.5 py-0">
                                Platform Fee
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-foreground whitespace-nowrap">
                            {item.counterparty}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-muted-foreground" title={item.description}>
                            {item.description}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-mono font-medium whitespace-nowrap tabular-nums",
                              item.type === "income" ? "text-success" : "text-muted-foreground"
                            )}
                          >
                            {item.type === "income" ? "+" : "-"}
                            {formatMoney(item.amount, item.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground whitespace-nowrap tabular-nums">
                            {formatPKR(item.amountPKR)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Warnings / Duplicates Notice */}
              {previewData.warnings.length > 0 && (
                <div className="rounded-md border border-amber-500/20 bg-amber-50/60 p-3 text-xs text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Info className="size-4 text-amber-600 shrink-0" />
                    <span>Import Warnings:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                    {previewData.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </DialogBody>

            <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewData(null)}
                disabled={importing}
              >
                <ArrowLeft className="size-4 mr-1" /> Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={importing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmImport}
                  disabled={importing || (previewData.incomeCount === 0 && previewData.expenseCount === 0)}
                >
                  {importing ? (
                    <>
                      <Loader2 className="size-4 mr-1.5 animate-spin" /> Importing…
                    </>
                  ) : (
                    `Confirm & Import (${previewData.totalRows} Transactions)`
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : (
          /* =========================================================================
             INITIAL UPLOAD & PLATFORM SELECTION SCREEN
             ========================================================================= */
          <>
            <DialogBody className="space-y-4">
              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-md border border-destructive/15 bg-destructive-surface p-3 text-sm text-destructive animate-fade-in"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              {/* Platform Filter Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">Auto-Detect</TabsTrigger>
                  <TabsTrigger value="upwork">Upwork</TabsTrigger>
                  <TabsTrigger value="fiverr">Fiverr</TabsTrigger>
                  <TabsTrigger value="generic">Custom CSV</TabsTrigger>
                </TabsList>

                <TabsContent value="upwork" className="mt-3">
                  <div className="rounded-md border border-emerald-500/20 bg-emerald-50/50 p-3 text-xs text-emerald-900">
                    <p className="font-semibold flex items-center gap-1.5">
                      <Briefcase className="size-3.5 text-emerald-600" /> Upwork Statement Export:
                    </p>
                    <p className="mt-1 text-emerald-800 leading-relaxed">
                      In Upwork, go to <strong>Reports &rarr; Transaction History</strong> and click <strong>Download CSV</strong>. The parser automatically extracts your client names, milestone invoices, and 10% platform service fees.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="fiverr" className="mt-3">
                  <div className="rounded-md border border-brand-500/20 bg-brand-50/50 p-3 text-xs text-brand-900">
                    <p className="font-semibold flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-brand-600" /> Fiverr Statement Export:
                    </p>
                    <p className="mt-1 text-brand-800 leading-relaxed">
                      In Fiverr, go to <strong>Earnings &rarr; Statement</strong> and click <strong>Export to CSV</strong>. The parser extracts buyer usernames, gig titles, cleared revenue, and 20% Fiverr commission fees.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="generic" className="mt-3">
                  <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">Custom / Multi-Platform CSV:</p>
                    <p className="mt-1 leading-relaxed">
                      Upload any standard CSV containing Date, Description, Amount, and optional columns like Client Name, Invoice Number, Currency, and Platform.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Drag and Drop Zone */}
              <button
                type="button"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                disabled={previewing}
                className={cn(
                  "flex w-full flex-col items-center rounded-lg border-2 border-dashed p-8 text-center transition-colors duration-150 ease-smooth",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2",
                  dragActive
                    ? "border-brand-500 bg-brand-50"
                    : "border-border-strong bg-muted/40 hover:border-brand-400 hover:bg-muted"
                )}
              >
                <span
                  className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-4 ring-brand-100"
                  aria-hidden="true"
                >
                  {previewing ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
                </span>
                <span className="mt-4 text-sm font-semibold text-foreground">
                  {previewing ? "Analyzing statement columns and clients…" : "Drop your statement here, or browse files"}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Supports Upwork, Fiverr, Wise, Payoneer & custom .csv files up to 5MB
                </span>
              </button>

              {/* Sample Templates & Demo Imports */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Quick Demo Statements & Templates
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => downloadSample(SAMPLE_UPWORK_CSV, "sample_upwork_statement.csv")}
                  >
                    <Download className="size-3.5 mr-1" /> Upwork Sample CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => downloadSample(SAMPLE_FIVERR_CSV, "sample_fiverr_statement.csv")}
                  >
                    <Download className="size-3.5 mr-1" /> Fiverr Sample CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handlePreview(undefined, SAMPLE_UPWORK_CSV)}
                    disabled={previewing}
                  >
                    <Sparkles className="size-3.5 mr-1 text-emerald-600" /> Demo Upwork Import
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handlePreview(undefined, SAMPLE_FIVERR_CSV)}
                    disabled={previewing}
                  >
                    <Sparkles className="size-3.5 mr-1 text-brand-600" /> Demo Fiverr Import
                  </Button>
                </div>
              </div>

              {/* Feature Highlights */}
              <div className="rounded-md border border-border bg-muted/40 p-3.5">
                <p className="text-xs font-semibold text-foreground">What happens during import?</p>
                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span><strong>Client Auto-Creation:</strong> Upwork clients and Fiverr buyers are automatically created or matched.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span><strong>Paid Invoices:</strong> Invoices with real order/reference IDs are generated automatically.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span><strong>Platform Fee Split:</strong> Service fees (Upwork 10%, Fiverr 20%) are logged as business expenses.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span><strong>Tax Engine Sync:</strong> IT export earnings qualify automatically for 0.25% / 1% final tax rates.</span>
                  </li>
                </ul>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={previewing}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

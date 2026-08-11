"use client";

import { useState, useRef } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import { apiErrorMessage, unwrapApi } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function CSVImportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedSuccess, setImportedSuccess] = useState(false);
  const [parsedCount, setParsedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // File Validation Logic
  const validateFile = (file: File): string | null => {
    const isCSVExtension = file.name.toLowerCase().endsWith('.csv');
    const isCSVMime = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.type === '';

    // Was computed but never checked — a non-CSV file renamed to end in
    // .csv passed this validation and only failed later, after upload,
    // with a less specific error from the parser.
    if (!isCSVExtension || !isCSVMime) {
      return `"${file.name}" isn't a CSV file. Upload a .csv statement instead.`;
    }

    if (file.size === 0) {
      return `That file is empty. Upload a statement with rows in it.`;
    }

    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `That file is over the ${MAX_SIZE_MB}MB limit. Split the statement or export a shorter range.`;
    }

    return null;
  };

  const processCSVUpload = async (file?: File, csvText?: string) => {
    setErrorMessage(null);

    if (file) {
      const validationError = validateFile(file);
      if (validationError) {
        setErrorMessage(validationError);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    setImporting(true);

    try {
      let res;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        res = await apiClient.post("/csv/import", formData);
      } else if (csvText) {
        res = await apiClient.post("/csv/import", { csvText });
      } else {
        throw new Error("No file or CSV text supplied");
      }

      const data = unwrapApi<{ totalParsed?: number }>(res);
      setParsedCount(data?.totalParsed || 0);
      setImportedSuccess(true);

      // Refresh every cache the import can affect. This used to invalidate a
      // literal ["reports"] key, which matches none of the real report query
      // keys below — none of the report charts ever refreshed after an import.
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["filing-readiness"] });
      queryClient.invalidateQueries({ queryKey: ["report-income-vs-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["report-income-consolidation"] });
    } catch (err: any) {
      // Was reading err.response.data.message, which doesn't exist on this
      // API's error envelope ({ error: { message, details } }) — every import
      // failure showed axios's generic "Request failed with status code 400"
      // instead of the real reason.
      setErrorMessage(apiErrorMessage(err, "Failed to process CSV import."));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const SAMPLE_CSV = `Date,Ref ID,Type,Description,Agency,Amount,Balance
08/01/2026,98123741,Hourly,"Invoice for Northwind Studio - Sprint 1 Fullstack Engineering",,1450.00,1450.00
08/01/2026,98123742,Service Fee,"Service Fee for Northwind Studio - Sprint 1 Fullstack Engineering",,-145.00,1305.00
08/03/2026,98123743,Fixed Price,"Milestone Payment from Larkfield Media - Mobile App API",,850.00,2155.00
08/03/2026,98123744,Service Fee,"Service Fee for Larkfield Media - Mobile App API",,-85.00,2070.00`;

  const handleSampleCSVImport = () => {
    processCSVUpload(undefined, SAMPLE_CSV);
  };

  const handleDownloadSampleCSV = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "freelancerhisab_sample_statement.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processCSVUpload(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCSVUpload(e.dataTransfer.files[0]);
    }
  };

  const handleClose = () => {
    // Reset so reopening starts clean rather than on the previous success screen.
    setImportedSuccess(false);
    setErrorMessage(null);
    setParsedCount(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />

        <DialogHeader>
          <DialogTitle>Import a statement</DialogTitle>
          <DialogDescription>
            Upwork transaction history, a Fiverr earnings statement, or a Wise / Payoneer export.
          </DialogDescription>
        </DialogHeader>

        {importedSuccess ? (
          <>
            <DialogBody>
              <div className="flex flex-col items-center py-6 text-center">
                <span
                  className="flex size-12 items-center justify-center rounded-md bg-success-surface text-success"
                  aria-hidden="true"
                >
                  <CheckCircle2 className="size-6" />
                </span>
                <h3 className="mt-5 text-base font-semibold text-foreground">Import complete</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  <span className="font-mono font-medium tabular-nums text-foreground">{parsedCount}</span> transaction
                  {parsedCount === 1 ? "" : "s"} added, with client profiles created for any new names.
                </p>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
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

              <button
                type="button"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className={cn(
                  "flex w-full flex-col items-center rounded-lg border-2 border-dashed p-8 text-center transition-colors duration-150 ease-smooth",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2",
                  dragActive
                    ? "border-brand-500 bg-brand-50"
                    : "border-border-strong bg-muted/40 hover:border-brand-400 hover:bg-muted"
                )}
              >
                <span
                  className="flex size-11 items-center justify-center rounded-md bg-brand-50 text-brand-700"
                  aria-hidden="true"
                >
                  {importing ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
                </span>
                <span className="mt-4 text-sm font-medium text-foreground">
                  {importing ? "Parsing your statement…" : "Drop a CSV here, or click to choose one"}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">.csv files up to 5MB</span>
              </button>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleDownloadSampleCSV}>
                  <Download /> Sample CSV
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleSampleCSVImport} disabled={importing}>
                  <FileSpreadsheet /> Try a demo import
                </Button>
              </div>

              <div className="rounded-md border border-border bg-muted/40 p-4">
                <p className="text-sm font-medium text-foreground">What the import does</p>
                <ul className="mt-2.5 space-y-1.5">
                  {[
                    "Creates client profiles for names it hasn't seen",
                    "Reads the payment currency and converts to PKR",
                    "Separates platform service fees from net earnings",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-brand-400" aria-hidden="true" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={importing}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

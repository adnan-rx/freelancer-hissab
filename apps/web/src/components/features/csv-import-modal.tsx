"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, FileSpreadsheet, Sparkles, X, AlertCircle, Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function CSVImportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedSuccess, setImportedSuccess] = useState(false);
  const [parsedCount, setParsedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // File Validation Logic
  const validateFile = (file: File): string | null => {
    const isCSVExtension = file.name.toLowerCase().endsWith('.csv');
    const isCSVMime = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.type === '';

    if (!isCSVExtension) {
      return `Invalid file format: "${file.name}". Please upload a valid .csv file.`;
    }

    if (file.size === 0) {
      return `Selected CSV file is empty (0 bytes). Please upload a valid statement.`;
    }

    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File size exceeds ${MAX_SIZE_MB}MB limit. Please upload a smaller statement file.`;
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

      const data = res.data.data || res.data;
      setParsedCount(data.totalParsed || 0);
      setImportedSuccess(true);

      // Refresh cache across dashboard, income, expenses, and clients
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch (err: any) {
      console.error("CSV Import Error:", err);
      const msg = err.response?.data?.message || err.message || "Failed to process CSV import";
      setErrorMessage(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSampleCSVImport = () => {
    const sampleUpworkCSV = `Date,Ref ID,Type,Description,Agency,Amount,Balance
08/01/2026,98123741,Hourly,"Invoice for TechFlow Labs - Sprint 1 Fullstack Engineering",,1450.00,1450.00
08/01/2026,98123742,Service Fee,"Service Fee for TechFlow Labs - Sprint 1 Fullstack Engineering",,-145.00,1305.00
08/03/2026,98123743,Fixed Price,"Milestone Payment from Acme Corp - Mobile App API",,850.00,2155.00
08/03/2026,98123744,Service Fee,"Service Fee for Acme Corp - Mobile App API",,-85.00,2070.00`;
    processCSVUpload(undefined, sampleUpworkCSV);
  };

  const handleDownloadSampleCSV = () => {
    const sampleCSVContent = `Date,Ref ID,Type,Description,Agency,Amount,Balance
08/01/2026,98123741,Hourly,"Invoice for TechFlow Labs - Sprint 1 Fullstack Engineering",,1450.00,1450.00
08/01/2026,98123742,Service Fee,"Service Fee for TechFlow Labs - Sprint 1 Fullstack Engineering",,-145.00,1305.00
08/03/2026,98123743,Fixed Price,"Milestone Payment from Acme Corp - Mobile App API",,850.00,2155.00
08/03/2026,98123744,Service Fee,"Service Fee for Acme Corp - Mobile App API",,-85.00,2070.00`;

    const blob = new Blob([sampleCSVContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "freelancerhisab_sample_statement.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processCSVUpload(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCSVUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept=".csv" 
          className="hidden" 
        />

        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            <h2 className="text-xl font-bold text-slate-100">Automated CSV / Statement Import</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100" type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!importedSuccess ? (
            <>
              <p className="text-sm text-slate-400">
                Upload your <strong className="text-slate-200">Upwork Transaction History CSV</strong>, <strong className="text-slate-200">Fiverr Earnings Statement</strong>, or <strong className="text-slate-200">Payoneer/Wise CSV</strong> to auto-import clients and income logs without manual entry.
              </p>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div 
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                  dragActive ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-3">
                  {importing ? <Sparkles className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                </div>
                <p className="text-sm font-semibold text-slate-200">
                  {importing ? "Parsing CSV & Ingesting Transactions..." : "Click to select CSV or drag & drop file"}
                </p>
                <p className="text-xs text-slate-500 mt-1">Only .csv files up to 5MB supported (Upwork, Fiverr, Wise, Payoneer)</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleDownloadSampleCSV}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                  Download Sample CSV
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleSampleCSVImport}
                  disabled={importing}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                  Import Demo Statement
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2 text-xs text-slate-400">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> What happens automatically?
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Creates new client profiles for missing clients</li>
                  <li>Auto-extracts payment currency (USD/EUR) & converts to PKR</li>
                  <li>Categorizes platform service fees vs. net withdrawal earnings</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto text-2xl">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100">Import Completed!</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Successfully extracted <strong className="text-emerald-400">{parsedCount} real transactions</strong> and created client profiles in PostgreSQL.
                </p>
              </div>
              <Button onClick={onClose} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-8">
                Done & View Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

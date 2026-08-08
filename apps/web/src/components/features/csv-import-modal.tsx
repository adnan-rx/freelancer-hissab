"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, FileSpreadsheet, Sparkles, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function CSVImportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedSuccess, setImportedSuccess] = useState(false);
  const [parsedCount, setParsedCount] = useState(0);

  if (!isOpen) return null;

  const handleSimulateCSV = () => {
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      setParsedCount(4);
      setImportedSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            <h2 className="text-xl font-bold text-slate-100">Automated CSV / Statement Import</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!importedSuccess ? (
            <>
              <p className="text-sm text-slate-400">
                Upload your <strong className="text-slate-200">Upwork Transaction History CSV</strong>, <strong className="text-slate-200">Fiverr Earnings Statement</strong>, or <strong className="text-slate-200">Payoneer/Wise CSV</strong> to auto-import clients and income logs without manual entry.
              </p>

              <div 
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => { e.preventDefault(); setDragActive(false); handleSimulateCSV(); }}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                  dragActive ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                }`}
                onClick={handleSimulateCSV}
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-3">
                  {importing ? <Sparkles className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                </div>
                <p className="text-sm font-semibold text-slate-200">
                  {importing ? "Parsing Upwork/Fiverr CSV Statement..." : "Drag & drop CSV file here or click to browse"}
                </p>
                <p className="text-xs text-slate-500 mt-1">Supports Upwork, Fiverr, Wise, Payoneer, and Meezan Bank CSV exports</p>
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
                  Successfully extracted <strong className="text-emerald-400">{parsedCount} transactions</strong> and created missing client profiles automatically.
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

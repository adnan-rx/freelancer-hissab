"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Search, 
  Sparkles, 
  FileText, 
  Users, 
  DollarSign, 
  Wallet, 
  PieChart, 
  ShieldCheck, 
  Upload, 
  Download,
  HelpCircle,
  ChevronRight,
  CheckCircle2
} from "lucide-react";
import Link from 'next/link';

export default function UserGuidePage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  const guideSections = [
    {
      id: "quickstart",
      category: "Getting Started",
      icon: Sparkles,
      color: "text-primary bg-primary/10 border-primary/20",
      title: "Quick Start Guide (Non-Tech Friendly)",
      description: "Learn how to set up your account, log income, and issue invoices in 4 simple steps.",
      steps: [
        { title: "Step 1: Set Up Bank Profile", desc: "Go to Settings and save your Name, Business Name, and Meezan Bank IBAN. This automatically populates your invoice wire instructions." },
        { title: "Step 2: Add Clients", desc: "Go to Clients and click '+ Add New Client'. Enter client name and email for Upwork, Fiverr, or Direct overseas clients." },
        { title: "Step 3: Create & Export Invoices", desc: "Go to Invoices → 'Create New Invoice'. Type your USD amount ($500). The app auto-converts to PKR at live rates and adds SBP wire notes." },
        { title: "Step 4: Track FBR Tax & Reports", desc: "Visit Reports anytime to see total revenue, profit margin, and exact 0.25% FBR Section 154A tax liability for your tax filer." },
      ]
    },
    {
      id: "invoicing",
      category: "Invoices",
      icon: FileText,
      color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
      title: "Creating & Exporting Invoices",
      description: "How to generate, brand, and download PDF invoices for international clients.",
      content: [
        "Select an existing client or type a new client name to automatically resolve or create client profiles.",
        "Live Market FX Conversion automatically populates the USD to PKR exchange rate (e.g. 280.50), with full support for manual rate overrides.",
        "Click 'Export PDF' on any invoice page to open the print dialog and save clean, professional invoices directly to your computer."
      ]
    },
    {
      id: "csvimport",
      category: "Automation",
      icon: Upload,
      color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
      title: "Automated CSV & Statement Ingestion",
      description: "Import Upwork, Fiverr, Wise, or Payoneer statements without manual entry.",
      content: [
        "Click 'Auto-Import Upwork/Fiverr CSV' on Dashboard, Income, or Expenses pages.",
        "Upload a .csv file (Upwork Transaction History or generic statement). The app automatically extracts client names, earnings, platform service fees, and PKR values.",
        "Client side file validation checks extension (.csv) and file size (< 5MB) before processing.",
        "Use the 'Download Sample CSV' button inside the modal to download a ready-made statement template."
      ]
    },
    {
      id: "tax",
      category: "Pakistani Tax & SBP Rules",
      icon: ShieldCheck,
      color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
      title: "FBR Section 154A & SBP Code 9100",
      description: "How to qualify for the 0.25% reduced IT export tax rate in Pakistan.",
      content: [
        "SBP Purpose Code 9100 / 9102 is the official State Bank classification for Computer Software / IT Export Services.",
        "When foreign remittances arrive under Code 9100, your bank (e.g. Meezan) issues a Proceeds Realization Certificate (PRC).",
        "PRC certificates prove to FBR that your income is genuine IT export revenue, entitling PSEB filers to the reduced 0.25% tax rate instead of 35% income tax."
      ]
    }
  ];

  const filteredSections = guideSections.filter(sec => {
    const matchesTab = activeTab === "all" || sec.category.toLowerCase().includes(activeTab);
    const matchesSearch = sec.title.toLowerCase().includes(search.toLowerCase()) || 
                          sec.description.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
              <BookOpen className="mr-1.5 h-3.5 w-3.5" /> Official Help Center
            </Badge>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">User Manual & Feature Guide</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Step-by-step instructions for managing clients, generating invoices, importing CSV statements, and FBR tax filings.
          </p>
        </div>

        <Button asChild>
          <Link href="/dashboard">
            Back to Dashboard <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          type="text" 
          placeholder="Search guide topics (e.g., invoice, CSV, SBP Code, tax)..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="pl-10 bg-background border-border text-foreground text-sm focus:border-primary"
        />
      </div>

      {/* Quick Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {filteredSections.map((sec) => {
          const Icon = sec.icon;
          return (
            <Card key={sec.id} className="hover:border-primary/30 transition-all shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${sec.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-foreground">{sec.title}</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">{sec.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 text-xs text-foreground">
                {sec.steps ? (
                  <div className="space-y-3">
                    {sec.steps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/50 border border-border">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-foreground">{step.title}</p>
                          <p className="text-muted-foreground text-[11px] leading-relaxed mt-0.5">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {sec.content?.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                        <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* SBP Code 9100 Explanation Banner */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> SBP Purpose Code 9100 Cheat Sheet
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-3">
          <p>
            When foreign wire transfers arrive in Meezan Bank, JazzCash, or Allied Bank, ensure your client or payment gateway tags the transaction under <strong className="text-foreground">State Bank Code 9100</strong> (Software Services Export).
          </p>
          <div className="grid gap-3 md:grid-cols-3 pt-2">
            <div className="p-3 rounded-xl bg-muted/50 border border-border">
              <span className="font-bold text-primary block mb-1">Code 9100</span>
              Software Development & IT Export Services
            </div>
            <div className="p-3 rounded-xl bg-muted/50 border border-border">
              <span className="font-bold text-teal-600 block mb-1">Code 9102</span>
              IT Enabled Services (BPO, Virtual Assistance)
            </div>
            <div className="p-3 rounded-xl bg-muted/50 border border-border">
              <span className="font-bold text-blue-500 block mb-1">PRC Document</span>
              Proceeds Realization Certificate from Meezan Bank
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

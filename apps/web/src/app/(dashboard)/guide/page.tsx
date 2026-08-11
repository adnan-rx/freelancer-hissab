"use client";

import { useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, FileText, PieChart, ShieldCheck, Sparkles, Upload, Wallet } from "lucide-react";
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/data-toolbar";
import { SegmentedFilter } from "@/components/ui/segmented-filter";

export default function UserGuidePage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  const guideSections = [
    {
      id: "quickstart",
      category: "Getting started",
      icon: Sparkles,
      title: "Set up in four steps",
      description: "Account, clients, invoices and tax — the shortest path to a working ledger.",
      steps: [
        { title: "Save your bank profile", desc: "In Settings, add your name, business name and IBAN. Your invoices pick up the wire instructions from there automatically." },
        { title: "Add your clients", desc: "On Clients, add the people and companies you bill — Upwork, Fiverr or direct overseas clients." },
        { title: "Create and export invoices", desc: "On Invoices, enter the amount in USD. It converts to PKR at the live rate and adds the SBP wire notes." },
        { title: "Track tax and reports", desc: "Reports shows revenue, profit margin and your Section 154A liability at your actual PSEB status." },
      ]
    },
    {
      id: "invoicing",
      category: "Invoices",
      icon: FileText,
      title: "Creating and exporting invoices",
      description: "Generating, branding and downloading PDF invoices for international clients.",
      content: [
        "Pick an existing client or type a new name — the client profile is resolved or created for you.",
        "The USD to PKR rate is filled in from live market data, and you can override it manually when the bank rate differs.",
        "Export PDF on any invoice opens the print dialog so you can save a clean copy to your computer."
      ]
    },
    {
      id: "csvimport",
      category: "Automation",
      icon: Upload,
      title: "Importing statements",
      description: "Bringing in Upwork, Fiverr, Wise or Payoneer statements without typing them out.",
      content: [
        "Use Import CSV on the Clients, Income or Expenses pages.",
        "Upload a .csv (Upwork transaction history or a generic statement). Client names, earnings, platform fees and PKR values are extracted for you.",
        "Files are checked for extension and size (under 5MB) before anything is processed.",
        "Download sample CSV inside the modal gives you a template to match."
      ]
    },
    {
      id: "tax",
      category: "Tax & SBP",
      icon: ShieldCheck,
      title: "Section 154A and SBP code 9100",
      description: "What it takes to qualify for the 0.25% reduced IT export tax rate.",
      content: [
        "SBP purpose code 9100 / 9102 is the State Bank classification for computer software and IT export services.",
        "When a remittance arrives under code 9100, your bank issues a Proceeds Realization Certificate (PRC).",
        "The PRC is what proves to FBR that the income is genuine IT export revenue — that's what entitles PSEB filers to 0.25% instead of normal slab rates."
      ]
    },
    {
      id: "wealth-recon",
      category: "Compliance",
      icon: Wallet,
      title: "Wealth reconciliation",
      description: "Making your declared assets line up with your reported income.",
      steps: [
        { title: "Declare opening wealth", desc: "On the Wealth page, enter the net wealth carried forward from last tax year." },
        { title: "Add assets and liabilities", desc: "List cash, property, vehicles and any loans. Net declared wealth is calculated from those." },
        { title: "Check the reconciliation", desc: "The app checks whether opening wealth plus income minus expenses equals your net declared wealth. FBR allows a variance of up to Rs 50,000." },
        { title: "If it doesn't balance", desc: "Review your income and expenses for missing entries before filing — a gap usually means something wasn't logged." }
      ]
    },
    {
      id: "tax-simulator",
      category: "Compliance",
      icon: PieChart,
      title: "Tax simulator",
      description: "Modelling liability and seeing what PSEB registration is worth.",
      content: [
        "The Tax Simulator breaks down gross income, expenses and estimated liability side by side with where you stand today.",
        "Toggle PSEB registered to see the difference between the 0.25% and 1% export rates on your own numbers.",
        "It runs on the same Section 154A rules the rest of the app uses."
      ]
    },
    {
      id: "filing-simulator",
      category: "Compliance",
      icon: CheckCircle2,
      title: "Filing readiness audit",
      description: "A pre-flight check before you submit anything to FBR.",
      steps: [
        { title: "Profile and income", desc: "Checks whether your profile is missing a PSEB ID and whether every income entry has a platform attached." },
        { title: "SBP and PRC details", desc: "Audits foreign income for a logged PRC reference and SBP purpose code on each export transaction." },
        { title: "Fix what it finds", desc: "Each issue links to the page where you can resolve it." },
        { title: "Submit on IRIS", desc: "This app is an auditing tool. Once readiness reaches 100%, you still submit the return yourself on the FBR IRIS portal using these figures." }
      ]
    }
  ];

  const filteredSections = guideSections.filter(sec => {
    const matchesTab = activeTab === "all" || sec.category.toLowerCase() === activeTab;
    const matchesSearch = sec.title.toLowerCase().includes(search.toLowerCase()) ||
                          sec.description.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // The category state and filter above existed with no control to drive
  // them, so `activeTab` could never be anything but "all" — these pills are
  // that missing control, not a new feature.
  const categories = Array.from(new Set(guideSections.map((sec) => sec.category)));
  const filterOptions = [
    { value: "all", label: "All topics" },
    ...categories.map((c) => ({ value: c.toLowerCase(), label: c })),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 lg:space-y-8">
      <PageHeader
        title="User guide"
        description="How to manage clients, raise invoices, import statements and get a tax year ready to file."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard">
              Back to dashboard <ArrowRight />
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search topics — invoice, CSV, SBP code…"
          aria-label="Search the guide"
          className="sm:w-80"
        />
        <SegmentedFilter options={filterOptions} value={activeTab} onChange={setActiveTab} ariaLabel="Filter by topic" />
      </div>

      {filteredSections.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="Nothing matches that search"
            description="Try a different term, or switch back to all topics."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setActiveTab("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          {filteredSections.map((sec) => {
            const Icon = sec.icon;
            return (
              <Card key={sec.id} className="flex flex-col">
                <div className="flex items-start gap-3 p-5 sm:p-6">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700"
                    aria-hidden="true"
                  >
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">{sec.category}</p>
                    <CardTitle>{sec.title}</CardTitle>
                    <CardDescription>{sec.description}</CardDescription>
                  </div>
                </div>

                <CardContent className="flex-1">
                  {sec.steps ? (
                    <ol className="space-y-2.5">
                      {sec.steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3">
                          <span
                            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-100 font-mono text-2xs font-semibold text-brand-800"
                            aria-hidden="true"
                          >
                            {idx + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-foreground">{step.title}</span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{step.desc}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <ul className="space-y-2.5">
                      {sec.content?.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-brand-400" aria-hidden="true" />
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
      )}

      <Card>
        <div className="p-5 sm:p-6">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-brand-600" aria-hidden="true" /> SBP purpose codes at a glance
          </CardTitle>
          <CardDescription className="mt-1.5 max-w-2xl">
            When a wire lands in your bank, the transaction has to be tagged under the right State Bank code for the
            reduced rate to apply. Ask your client or gateway to use these.
          </CardDescription>
        </div>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              { code: "9100", label: "Software development and IT export services" },
              { code: "9102", label: "IT-enabled services — BPO, virtual assistance" },
              { code: "PRC", label: "Proceeds Realization Certificate, issued by your bank" },
            ].map((item) => (
              <div key={item.code} className="rounded-md border border-border bg-muted/40 p-4">
                <dt className="font-mono text-sm font-semibold text-brand-700">{item.code}</dt>
                <dd className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.label}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

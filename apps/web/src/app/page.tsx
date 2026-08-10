"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { DollarSign, Zap, TrendingUp, ArrowRight, CheckCircle2, Calculator, Wallet, Users } from "lucide-react";

export default function Home() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Header Navigation */}
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground p-2 rounded-xl font-bold shadow-sm">
              Rs
            </div>
            <span className="text-xl font-extrabold tracking-tight text-foreground">
              Freelancer<span className="text-primary">Hisab</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-24 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-secondary text-primary text-sm font-medium mb-10">
          <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
          Financial Operating System Built for Pakistani Freelancers 🇵🇰
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight max-w-4xl leading-[1.1] text-foreground">
          Master Your Earnings. <br />
          <span className="text-primary">
            Track USD to PKR Automatically.
          </span>
        </h1>

        <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
          Log client earnings from Upwork, Fiverr & Direct clients. Generate professional invoices, track expenses, and forecast your cash flow effortlessly.
        </p>

        <div className="mt-12 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          {isAuthenticated ? (
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-6 text-lg rounded-xl shadow-sm transition-all active:scale-[0.98]">
                Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-6 text-lg rounded-xl shadow-sm transition-all active:scale-[0.98]">
                  Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-border text-foreground hover:bg-secondary px-8 py-6 text-lg rounded-xl transition-all active:scale-[0.98]">
                  Sign In
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-32 text-left w-full">
          <div className="p-8 rounded-3xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-secondary border border-primary/10 flex items-center justify-center text-primary mb-6">
              <DollarSign className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Multi-Currency Income</h3>
            <p className="mt-3 text-muted-foreground leading-relaxed text-sm">
              Log payments in USD, EUR, or GBP. Auto-convert to PKR at live exchange rates so you always know your exact home income.
            </p>
          </div>

          <div className="p-8 rounded-3xl border border-primary/20 bg-secondary shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-primary/5">
              <Zap className="h-32 w-32" />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-background border border-primary/20 flex items-center justify-center text-primary mb-6">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Instant Invoicing Builder</h3>
              <p className="mt-3 text-muted-foreground leading-relaxed text-sm">
                Create and manage client invoices with dynamic line items, automated tax & discount calculations, and status tracking.
              </p>
            </div>
          </div>

          <div className="p-8 rounded-3xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-secondary border border-primary/10 flex items-center justify-center text-primary mb-6">
              <Calculator className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground">FBR Tax Simulator</h3>
            <p className="mt-3 text-muted-foreground leading-relaxed text-sm">
              Simulate your tax liability in real-time based on your total income and business expenses according to FBR guidelines.
            </p>
          </div>

          <div className="p-8 rounded-3xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-secondary border border-primary/10 flex items-center justify-center text-primary mb-6">
              <Wallet className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Wealth Reconciliation</h3>
            <p className="mt-3 text-muted-foreground leading-relaxed text-sm">
              Track your assets and liabilities. Automatically reconcile your wealth statement to ensure you are ready for tax filing.
            </p>
          </div>

          <div className="p-8 rounded-3xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-secondary border border-primary/10 flex items-center justify-center text-primary mb-6">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Financial Reports & Charts</h3>
            <p className="mt-3 text-muted-foreground leading-relaxed text-sm">
              Visualize monthly revenue, expense trends, and client/platform contribution graphs with real-time analytics.
            </p>
          </div>

          <div className="p-8 rounded-3xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-secondary border border-primary/10 flex items-center justify-center text-primary mb-6">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Client Management</h3>
            <p className="mt-3 text-muted-foreground leading-relaxed text-sm">
              Keep a detailed directory of your clients, track their specific payment histories, and manage outstanding balances.
            </p>
          </div>
        </div>

        {/* Perks Checklist */}
        <div className="mt-20 flex flex-wrap justify-center gap-8 text-muted-foreground text-sm font-medium">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" /> Upwork & Fiverr Ready
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" /> SBP PRCs & Bank Tracking
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" /> Secure JWT Auth & Data Isolation
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © 2026 FreelancerHisab. Built for Pakistani Freelancers. All rights reserved.
      </footer>
    </div>
  );
}

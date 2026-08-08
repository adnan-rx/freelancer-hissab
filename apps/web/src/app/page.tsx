"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { DollarSign, Shield, Zap, TrendingUp, ArrowRight, CheckCircle2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Header Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 text-white p-2 rounded-xl font-bold shadow-lg shadow-emerald-900/40">
              Rs
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white">
              Freelancer<span className="text-emerald-400">Hisab</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-slate-300 hover:text-white">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-20 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-medium mb-8">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Financial Operating System Built for Pakistani Freelancers 🇵🇰
        </div>

        <h1 className="text-5xl md:text-6xl font-black tracking-tight max-w-4xl leading-tight">
          Master Your Earnings. <br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
            Track USD to PKR Automatically.
          </span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-slate-400 max-w-2xl leading-relaxed">
          Log client earnings from Upwork, Fiverr & Direct clients. Generate professional invoices, track expenses, and forecast your cash flow effortlessly.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link href="/register" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-6 text-lg rounded-xl shadow-xl shadow-emerald-900/40">
              Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white px-8 py-6 text-lg rounded-xl">
              Demo Login
            </Button>
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 text-left w-full">
          <div className="p-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:border-emerald-500/30 transition duration-300">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6">
              <DollarSign className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-100">Multi-Currency PKR Conversion</h3>
            <p className="mt-3 text-slate-400 leading-relaxed text-sm">
              Log payments in USD, EUR, or GBP. Auto-convert to PKR at live exchange rates so you always know your exact home income.
            </p>
          </div>

          <div className="p-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:border-emerald-500/30 transition duration-300">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-100">Instant Invoicing Builder</h3>
            <p className="mt-3 text-slate-400 leading-relaxed text-sm">
              Create and manage client invoices with dynamic line items, automated tax & discount calculations, and status tracking.
            </p>
          </div>

          <div className="p-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:border-emerald-500/30 transition duration-300">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-100">Financial Reports & Charts</h3>
            <p className="mt-3 text-slate-400 leading-relaxed text-sm">
              Visualize monthly revenue, expense trends, and client/platform contribution graphs with real-time analytics.
            </p>
          </div>
        </div>

        {/* Perks Checklist */}
        <div className="mt-16 flex flex-wrap justify-center gap-8 text-slate-400 text-sm font-medium">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Upwork & Fiverr Ready
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> SBP PRCs & Bank Tracking
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Secure JWT Auth & Data Isolation
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500">
        © 2026 FreelancerHisab. Built for Pakistani Freelancers. All rights reserved.
      </footer>
    </div>
  );
}

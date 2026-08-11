"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Calculator,
  FileText,
  Landmark,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";

import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { GroupedBarChart } from "@/components/ui/charts";
import { StatCard } from "@/components/ui/stat-card";

/**
 * The hero preview renders the product's real StatCard and chart components so
 * the page shows the actual interface rather than a drawn mock-up. The figures
 * are illustrative and labelled as such on screen.
 */
const SAMPLE_MONTHS = [
  { label: "Jul", values: [412000, 96400] },
  { label: "Aug", values: [386500, 88200] },
  { label: "Sep", values: [524800, 104900] },
  { label: "Oct", values: [468200, 91700] },
  { label: "Nov", values: [612400, 132600] },
  { label: "Dec", values: [578900, 118300] },
];

const CAPABILITIES = [
  {
    icon: FileText,
    title: "Invoices that close themselves",
    body: "Line items, tax and discounts calculated as you type. Status moves from draft to paid, and paid invoices land in your income ledger.",
    span: "sm:col-span-3",
  },
  {
    icon: Users,
    title: "Client ledger",
    body: "Payment history and outstanding balance per client.",
    span: "sm:col-span-3",
  },
  {
    icon: Receipt,
    title: "Expenses with evidence",
    body: "Attach the receipt when you log the spend, not the week before filing.",
    span: "sm:col-span-2",
  },
  {
    icon: Landmark,
    title: "Wealth reconciliation",
    body: "Assets and liabilities tracked against your declared income, so the statement balances.",
    span: "sm:col-span-2",
  },
  {
    icon: TrendingUp,
    title: "Reports",
    body: "Profit and loss for any date range, exportable as PDF.",
    span: "sm:col-span-2",
  },
];

const FILING_STEPS = [
  {
    title: "Record as you earn",
    body: "Log a payment in USD, EUR or GBP. It is converted to PKR at the rate on the day it arrived and stored with that rate attached.",
  },
  {
    title: "Watch the readiness score",
    body: "A running check tells you exactly what is missing — untagged income, expenses without evidence, a wealth statement that does not reconcile.",
  },
  {
    title: "Generate the package",
    body: "When the score reaches 100%, export the ledgers, the Section 154A calculation and the wealth statement in one download.",
  },
];

export default function Home() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
            <Logo />
          </Link>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Button asChild size="sm">
                <Link href="/dashboard">
                  Dashboard <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>

      <main id="main-content" className="flex-1">
        {/* Hero — copy left, live product surface right */}
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:pb-24">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-brand-600">
                Financial OS for Pakistani freelancers
              </p>
              <h1 className="mt-5 text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-[3.5rem]">
                Your foreign earnings, ready for the FBR.
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
                Track income in any currency, keep expenses with evidence, and file a tax year that reconciles.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                    {isAuthenticated ? "Open dashboard" : "Get started"} <ArrowRight />
                  </Link>
                </Button>
                {!isAuthenticated && (
                  <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                    <Link href="/login">Sign in</Link>
                  </Button>
                )}
              </div>
            </div>

            {/* Real components, illustrative figures — labelled below. */}
            <div className="relative">
              <div className="rounded-xl border border-border bg-card p-4 shadow-lg sm:p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatCard label="Net profit" value="Rs 2,367,400" icon={TrendingUp} emphasis hint="Tax year 2025-26" />
                  <StatCard label="Total income" value="Rs 2,982,800" icon={ArrowUpRight} delta={12} />
                </div>
                <div className="mt-3 rounded-lg border border-border p-4">
                  <p className="mb-4 text-sm font-medium text-foreground">Income vs expenses</p>
                  <GroupedBarChart
                    data={SAMPLE_MONTHS}
                    height={150}
                    caption="Illustrative monthly income and expenses"
                    series={[
                      { key: "income", label: "Income", color: "bg-chart-1" },
                      { key: "expenses", label: "Expenses", color: "bg-chart-2" },
                    ]}
                  />
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-subtle">
                The product&apos;s own interface. Figures shown are illustrative.
              </p>
            </div>
          </div>
        </section>

        {/* Fact strip */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-px bg-border px-0 sm:grid-cols-3">
            {[
              { k: "Jul – Jun", v: "Every figure scoped to the Pakistani tax year, not the calendar year" },
              { k: "Section 154A", v: "Export tax worked out at your actual PSEB registration status" },
              { k: "USD · EUR · GBP", v: "Converted at the rate on the day the payment landed" },
            ].map((item) => (
              <div key={item.k} className="bg-card px-5 py-7 sm:px-8">
                <p className="font-mono text-sm font-semibold tracking-[-0.01em] text-brand-700">{item.k}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Capabilities — asymmetric grid, one cell per capability */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[2.25rem]">
            The whole year in one ledger
          </h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-6">
            {CAPABILITIES.map((item) => (
              <article
                key={item.title}
                className={`${item.span} group rounded-lg border border-border bg-card p-6 transition-[border-color,box-shadow] duration-200 ease-smooth hover:border-border-strong hover:shadow-md`}
              >
                <span
                  className="flex size-10 items-center justify-center rounded-md bg-brand-50 text-brand-700"
                  aria-hidden="true"
                >
                  <item.icon className="size-5" strokeWidth={1.75} />
                </span>
                <h3 className="mt-5 text-base font-semibold tracking-[-0.01em] text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Filing flow — numbered steps against a tinted band */}
        <section className="border-y border-border bg-muted/50">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-20">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-brand-600">Filing</p>
                <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[2.25rem]">
                  From first payment to filing package
                </h2>
                <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
                  The work happens through the year, not in the week before the deadline.
                </p>
                <Button asChild variant="outline" className="mt-7">
                  <Link href="/register">
                    Start tracking <ArrowRight />
                  </Link>
                </Button>
              </div>

              <ol className="space-y-px overflow-hidden rounded-lg border border-border bg-border">
                {FILING_STEPS.map((step, i) => (
                  <li key={step.title} className="flex gap-5 bg-card p-6 sm:p-7">
                    <span className="font-mono text-sm font-semibold tabular-nums text-brand-600" aria-hidden="true">
                      0{i + 1}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold tracking-[-0.01em] text-foreground">{step.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Tax tooling — split, reversed from the hero */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 grid gap-4 sm:grid-cols-2 lg:order-1">
              {[
                { icon: Calculator, label: "Tax simulator", body: "Model liability before you commit to a rate." },
                { icon: ShieldCheck, label: "Readiness score", body: "One number for how close you are to filing." },
                { icon: Landmark, label: "Wealth statement", body: "Assets and liabilities reconciled to income." },
                { icon: Receipt, label: "Evidence vault", body: "Receipts and PRCs stored against each entry." },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border bg-card p-5">
                  <item.icon className="size-5 text-brand-600" strokeWidth={1.75} aria-hidden="true" />
                  <p className="mt-4 text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="order-1 lg:order-2">
              <h2 className="text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[2.25rem]">
                Know the number before the deadline decides it for you
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
                Export tax under Section 154A depends on whether you are PSEB-registered and whether your remittances
                carry the right purpose codes. FreelancerHisab reads your own records and tells you where you stand.
              </p>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 py-16 sm:px-8 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="max-w-lg text-3xl font-semibold leading-tight tracking-[-0.02em] text-balance sm:text-[2.25rem]">
              Start the tax year with the records already in order
            </h2>
            <Button
              asChild
              size="lg"
              className="w-full shrink-0 bg-card text-brand-900 hover:bg-brand-50 sm:w-auto"
            >
              <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                {isAuthenticated ? "Open dashboard" : "Get started"} <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
          <Logo />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/login" className="underline-offset-4 transition-colors hover:text-foreground hover:underline">
              Sign in
            </Link>
            <Link href="/register" className="underline-offset-4 transition-colors hover:text-foreground hover:underline">
              Create account
            </Link>
            <Link href="/guide" className="underline-offset-4 transition-colors hover:text-foreground hover:underline">
              User guide
            </Link>
          </nav>
          <p className="text-xs text-subtle">© 2026 FreelancerHisab</p>
        </div>
      </footer>
    </div>
  );
}

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowRight, CheckCircle2, Download, FileText, Loader2, RefreshCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { PageHeader } from "@/components/ui/page-header"
import { ErrorState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthStore } from "@/stores/auth.store"
import { useProfile } from "@/hooks/use-profile"
import { useGeneratePackage } from "@/hooks/use-generate-package"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "@/lib/api-client"
import { apiErrorMessage } from "@/lib/utils"
import { getCurrentTaxYear, taxYearOptions } from "@/lib/tax-year"

type Step = {
  id: string
  title: string
  description: string
  isComplete: boolean
  warnings: string[]
  fixPath?: string
}

export default function FilingSimulatorPage() {
  const token = useAuthStore((state) => state.accessToken)
  const { data: profile } = useProfile()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [taxYear, setTaxYear] = useState(() => String(getCurrentTaxYear()))

  const [readiness, setReadiness] = useState<any>(null)
  const [wealth, setWealth] = useState<any>(null)

  const { generatePackage, isGenerating, generateError } = useGeneratePackage()

  // Uses the shared apiClient so an expired access token is refreshed and the
  // request retried, instead of silently 401-ing like the old raw fetch did.
  const fetchData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [readinessRes, wealthRes] = await Promise.all([
        apiClient.get(`/filing/readiness?year=${taxYear}`),
        apiClient.get(`/wealth/reconciliation?year=${taxYear}`),
      ])
      setReadiness(readinessRes.data?.data ?? readinessRes.data)
      setWealth(wealthRes.data?.data ?? wealthRes.data)
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load your filing readiness."))
    } finally {
      setLoading(false)
    }
  }, [token, taxYear])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const issuesList = readiness?.issues || []
  const issuesFor = (...codes: string[]) => issuesList.filter((i: any) => codes.includes(i.code))
  const messagesFor = (...codes: string[]) => issuesFor(...codes).map((i: any) => i.message)

  // PSEB status comes from the saved profile — the auth payload alone used to be
  // missing this field, which left step 1 permanently incomplete.
  const hasPseb = !!(profile?.psebId || readiness?.profileComplete)

  const steps: Step[] = [
    {
      id: "profile",
      title: "Personal information",
      description: "Your FBR NTN and PSEB registration.",
      isComplete: hasPseb,
      warnings: hasPseb ? [] : ["No PSEB registration on file — you lose the 0.75% rate reduction."],
      fixPath: "/settings",
    },
    {
      id: "income",
      title: "Income ledger",
      description: "Every payment for the tax year, tagged to a platform or client.",
      isComplete: issuesFor("INCOME_UNMATCHED_PLATFORM", "ORPHANED_PAID_INVOICE").length === 0,
      warnings: messagesFor("INCOME_UNMATCHED_PLATFORM", "ORPHANED_PAID_INVOICE"),
      fixPath: "/income",
    },
    {
      id: "expenses",
      title: "Expense categories",
      description: "Every expense assigned a valid tax category.",
      isComplete: issuesFor("EXPENSE_MISSING_CATEGORY").length === 0,
      warnings: messagesFor("EXPENSE_MISSING_CATEGORY"),
      fixPath: "/expenses",
    },
    {
      id: "audit",
      title: "Financial audit",
      description: "SBP purpose codes, PRC numbers and exchange rates mapped.",
      isComplete: issuesFor("MISSING_PRC_SBP", "MISSING_EXCHANGE_RATE").length === 0,
      warnings: messagesFor("MISSING_PRC_SBP", "MISSING_EXCHANGE_RATE"),
      fixPath: "/income",
    },
    {
      id: "evidence",
      title: "Supporting documents",
      description: `Proof attached to your income entries — ${readiness?.evidenceCoveragePercent ?? 0}% covered.`,
      isComplete: issuesFor("MISSING_EVIDENCE").length === 0,
      warnings: messagesFor("MISSING_EVIDENCE"),
      fixPath: "/income",
    },
    {
      id: "wealth",
      title: "Wealth reconciliation",
      description: "Declared assets that balance against income and expenses.",
      isComplete: !!wealth?.reconciled,
      warnings: wealth?.reconciled
        ? []
        : [`Wealth statement is out by Rs ${Math.abs(Math.round(wealth?.differencePKR || 0)).toLocaleString()}.`],
      fixPath: "/wealth",
    },
  ]

  const completedSteps = steps.filter((s) => s.isComplete).length
  const percentComplete = (completedSteps / steps.length) * 100
  const isReady = completedSteps === steps.length
  const totalWarnings = steps.reduce((sum, step) => sum + step.warnings.length, 0)

  return (
    <div id="simulator-dashboard" className="mx-auto max-w-4xl space-y-6 lg:space-y-8">
      <PageHeader
        title="Filing simulator"
        description={`A step-by-step check of your FBR return${readiness?.taxYearLabel ? ` for ${readiness.taxYearLabel}` : ""}.`}
        actions={
          <>
            <Select value={taxYear} onValueChange={setTaxYear}>
              <SelectTrigger className="w-[10rem]" aria-label="Tax year">
                <SelectValue placeholder="Tax year" />
              </SelectTrigger>
              <SelectContent>
                {taxYearOptions().map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCcw className={loading ? "animate-spin" : undefined} /> Refresh
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-lg" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState
            description={error}
            action={
              <Button variant="outline" onClick={fetchData}>
                <RefreshCcw /> Try again
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <Card className={isReady ? "border-success/20 bg-success-surface" : undefined}>
            <CardContent className="p-6 pt-6 sm:p-8 sm:pt-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Filing readiness</p>
                  <p className="mt-1 font-mono text-4xl font-semibold tracking-[-0.03em] tabular-nums text-foreground">
                    {Math.round(percentComplete)}%
                  </p>
                </div>
                <p
                  className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                    totalWarnings > 0 ? "text-warning" : "text-success"
                  }`}
                >
                  {totalWarnings > 0 ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
                  {totalWarnings > 0
                    ? `${totalWarnings} unresolved ${totalWarnings === 1 ? "issue" : "issues"}`
                    : "Ready to file"}
                </p>
              </div>
              <Progress
                value={percentComplete}
                className="mt-5 h-2"
                indicatorClassName={isReady ? "bg-success" : "bg-primary"}
                aria-label="Filing readiness"
              />
              <p className="mt-2.5 text-xs text-muted-foreground">
                {completedSteps} of {steps.length} steps complete
              </p>
            </CardContent>
          </Card>

          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={step.id}>
                <Card className={step.isComplete ? "border-l-2 border-l-success" : "border-l-2 border-l-warning"}>
                  <CardContent className="flex gap-4 p-5 pt-5 sm:p-6 sm:pt-6">
                    <span className="mt-0.5 shrink-0" aria-hidden="true">
                      {step.isComplete ? (
                        <CheckCircle2 className="size-5 text-success" />
                      ) : (
                        <span className="flex size-5 items-center justify-center rounded-full border border-border-strong font-mono text-2xs font-semibold text-muted-foreground">
                          {index + 1}
                        </span>
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground">{step.title}</h2>
                        {!step.isComplete && step.fixPath && (
                          <Button variant="ghost" size="sm" asChild className="print:hidden">
                            <Link href={step.fixPath}>
                              Fix this <ArrowRight />
                            </Link>
                          </Button>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.description}</p>

                      {step.warnings.length > 0 && (
                        <ul className="mt-4 space-y-2">
                          {step.warnings.map((warning, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 rounded-md border border-warning/15 bg-warning-surface p-2.5 text-sm leading-relaxed text-warning"
                            >
                              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                              <span>{warning}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>

          <Card className="border-brand-200 bg-brand-50/50 print:hidden">
            <CardContent className="flex flex-col items-center p-8 pt-8 text-center">
              <span
                className="flex size-12 items-center justify-center rounded-md bg-primary text-primary-foreground"
                aria-hidden="true"
              >
                <FileText className="size-6" />
              </span>
              <h2 className="mt-5 text-lg font-semibold tracking-[-0.01em] text-foreground">Generate filing package</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                A ZIP with your tax summary, income report, expense report and the full transaction ledger.
              </p>

              <Button size="lg" className="mt-6" disabled={isGenerating} onClick={() => generatePackage(taxYear)}>
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" /> Compiling…
                  </>
                ) : (
                  <>
                    <Download /> Download package
                  </>
                )}
              </Button>

              {generateError && (
                <p className="mt-3 text-sm font-medium text-destructive" role="alert">
                  {generateError}
                </p>
              )}
              {!isReady && (
                <p className="mt-3 text-sm text-warning">
                  {totalWarnings} issue{totalWarnings === 1 ? "" : "s"} still open — the package reflects your data as it
                  stands today.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

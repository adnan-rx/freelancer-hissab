"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Download, FileText, AlertCircle, RefreshCcw, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useAuthStore } from "@/stores/auth.store"
import { useProfile } from "@/hooks/use-profile"
import { useGeneratePackage } from "@/hooks/use-generate-package"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "@/lib/api-client"
import { apiErrorMessage } from "@/lib/utils"
import { getCurrentTaxYear, taxYearOptions } from "@/lib/tax-year"
import { Skeleton } from "@/components/ui/skeleton"

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

  if (loading) {
    return (
      <div id="simulator-dashboard" className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Filing Simulator</h1>
            <p className="text-muted-foreground mt-1">
              A guided walkthrough of your FBR tax return preparation.
            </p>
          </div>
          <div className="flex gap-4 items-center">
            <Skeleton className="h-10 w-[150px]" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        <Card className="border-2 border-border">
          <CardContent className="p-8">
            <div className="flex items-end justify-between mb-4">
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-20" />
              </div>
              <Skeleton className="h-6 w-36" />
            </div>
            <Skeleton className="h-3 w-full" />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-l-4 border-l-border">
              <CardContent className="p-6">
                <div className="flex gap-4 items-start">
                  <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-44" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-4 w-80" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const issuesList = readiness?.issues || []
  const issuesFor = (...codes: string[]) => issuesList.filter((i: any) => codes.includes(i.code))
  const messagesFor = (...codes: string[]) => issuesFor(...codes).map((i: any) => i.message)

  // PSEB status comes from the saved profile — the auth payload alone used to be
  // missing this field, which left step 1 permanently incomplete.
  const hasPseb = !!(profile?.psebId || readiness?.profileComplete)

  const steps: Step[] = [
    {
      id: "profile",
      title: "Personal Information",
      description: "Verify your FBR NTN and PSEB registration.",
      isComplete: hasPseb,
      warnings: hasPseb ? [] : ["Missing PSEB registration (loss of 0.75% tax break)"],
      fixPath: "/settings",
    },
    {
      id: "income",
      title: "Income Ledger",
      description: "Verify all income for the tax year.",
      isComplete: issuesFor("INCOME_UNMATCHED_PLATFORM", "ORPHANED_PAID_INVOICE").length === 0,
      warnings: messagesFor("INCOME_UNMATCHED_PLATFORM", "ORPHANED_PAID_INVOICE"),
      fixPath: "/income",
    },
    {
      id: "expenses",
      title: "Expense Categorization",
      description: "Verify all expenses have valid tax categories.",
      isComplete: issuesFor("EXPENSE_MISSING_CATEGORY").length === 0,
      warnings: messagesFor("EXPENSE_MISSING_CATEGORY"),
      fixPath: "/expenses",
    },
    {
      id: "audit",
      title: "Financial Audit",
      description: "Ensure SBP purpose codes and PRC numbers are mapped.",
      isComplete: issuesFor("MISSING_PRC_SBP", "MISSING_EXCHANGE_RATE").length === 0,
      warnings: messagesFor("MISSING_PRC_SBP", "MISSING_EXCHANGE_RATE"),
      fixPath: "/income",
    },
    {
      id: "evidence",
      title: "Supporting Documents",
      description: `Attach proof for your income entries (${readiness?.evidenceCoveragePercent ?? 0}% covered).`,
      isComplete: issuesFor("MISSING_EVIDENCE").length === 0,
      warnings: messagesFor("MISSING_EVIDENCE"),
      fixPath: "/income",
    },
    {
      id: "wealth",
      title: "Wealth Reconciliation",
      description: "Ensure declared assets match income and expenses.",
      isComplete: !!wealth?.reconciled,
      warnings: wealth?.reconciled
        ? []
        : [`Wealth gap of Rs. ${Math.abs(Math.round(wealth?.differencePKR || 0)).toLocaleString()} detected`],
      fixPath: "/wealth",
    },
  ]

  const completedSteps = steps.filter((s) => s.isComplete).length
  const percentComplete = (completedSteps / steps.length) * 100
  const isReady = completedSteps === steps.length
  const totalWarnings = steps.reduce((sum, step) => sum + step.warnings.length, 0)

  return (
    <div id="simulator-dashboard" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Filing Simulator</h1>
          <p className="text-muted-foreground mt-1">
            A guided walkthrough of your FBR tax return preparation
            {readiness?.taxYearLabel ? ` for ${readiness.taxYearLabel}` : ""}.
          </p>
        </div>
        <div className="flex gap-4 items-center print:hidden">
          <Select value={taxYear} onValueChange={setTaxYear}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tax Year" />
            </SelectTrigger>
            <SelectContent>
              {taxYearOptions().map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center justify-between gap-4">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={fetchData}>Retry</Button>
        </div>
      )}

      <Card className="bg-gradient-to-r from-card to-card/50 border-2">
        <CardContent className="p-8">
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Filing Readiness</p>
              <h2 className="text-4xl font-bold tracking-tight">{Math.round(percentComplete)}%</h2>
            </div>
            <div className="text-right">
              {totalWarnings > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium">
                  <AlertCircle className="h-5 w-5" />
                  {totalWarnings} unresolved {totalWarnings === 1 ? "issue" : "issues"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                  <CheckCircle2 className="h-5 w-5" />
                  Ready to file
                </span>
              )}
            </div>
          </div>
          <Progress value={percentComplete} className="h-3" indicatorClassName={isReady ? "bg-emerald-500" : "bg-primary"} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {steps.map((step, index) => (
          <Card key={step.id} className={`transition-all border-l-4 ${step.isComplete ? "border-l-emerald-500" : "border-l-border"}`}>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="shrink-0 mt-1">
                  {step.isComplete ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-muted-foreground flex items-center justify-center text-xs font-medium text-muted-foreground">
                      {index + 1}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    {!step.isComplete && step.fixPath && (
                      <Button variant="link" size="sm" asChild className="print:hidden">
                        <Link href={step.fixPath}>
                          Fix this <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm mt-1">{step.description}</p>

                  {step.warnings.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {step.warnings.map((warning, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-amber-600 bg-amber-500/10 p-2.5 rounded-md">
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>{warning}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-2 border-primary/20 bg-primary/5 print:hidden">
        <CardContent className="p-8 text-center space-y-4">
          <FileText className="h-12 w-12 text-primary mx-auto opacity-80" />
          <h2 className="text-2xl font-bold">Generate Filing Package</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Downloads a ZIP containing your tax summary, income report, expense report and full transaction ledger.
          </p>
          <Button size="lg" disabled={isGenerating} onClick={() => generatePackage(taxYear)} className="mt-4">
            {isGenerating ? "Compiling Package..." : (
              <>
                <Download className="mr-2 h-5 w-5" />
                Download Tax Package (ZIP)
              </>
            )}
          </Button>
          {generateError && <p className="text-sm text-destructive font-medium">{generateError}</p>}
          {!isReady && (
            <p className="text-sm text-amber-600 font-medium">
              {totalWarnings} issue{totalWarnings === 1 ? "" : "s"} still open — the package will reflect your data as it stands today.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

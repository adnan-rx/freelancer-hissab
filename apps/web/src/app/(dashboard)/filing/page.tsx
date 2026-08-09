"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, ChevronRight, Download, FileText, AlertCircle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useAuthStore } from "@/stores/auth.store"
import { useGeneratePackage } from "@/hooks/use-generate-package"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Step = {
  id: string
  title: string
  description: string
  isComplete: boolean
  warnings: string[]
}

export default function FilingSimulatorPage() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const [loading, setLoading] = useState(true)
  const [taxYear, setTaxYear] = useState("2026")
  
  const [readiness, setReadiness] = useState<any>(null)
  const [wealth, setWealth] = useState<any>(null)
  
  const { generatePackage, isGenerating } = useGeneratePackage()

  const fetchData = async () => {
    if (!token) return
    try {
      setLoading(true)
      const headers = { Authorization: `Bearer ${token}` }
      
      const [readinessRes, wealthRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/filing/readiness`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/wealth/reconciliation?year=${taxYear}`, { headers })
      ])

      const rData = await readinessRes.json()
      const wData = await wealthRes.json()

      setReadiness(rData)
      setWealth(wData)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [token, taxYear])

  if (loading) return <div className="p-8">Loading simulator...</div>

  // Construct Wizard Steps
  const steps: Step[] = [
    {
      id: "profile",
      title: "Personal Information",
      description: "Verify your FBR NTN and PSEB registration.",
      isComplete: user?.hasPseb || false,
      warnings: user?.hasPseb ? [] : ["Missing PSEB registration (loss of 0.75% tax break)"]
    },
    {
      id: "income",
      title: "Income Ledger",
      description: "Verify all income for the tax year.",
      isComplete: !(readiness?.issues || []).some((i: string) => i.includes("missing equivalent income")),
      warnings: (readiness?.issues || []).filter((i: string) => i.includes("income"))
    },
    {
      id: "expenses",
      title: "Expense Categorization",
      description: "Verify all expenses have valid tax categories.",
      isComplete: !(readiness?.issues || []).some((i: string) => i.includes("Uncategorized")),
      warnings: (readiness?.issues || []).filter((i: string) => i.includes("Uncategorized"))
    },
    {
      id: "audit",
      title: "Financial Audit",
      description: "Ensure SBP purpose codes and PRC numbers are mapped.",
      isComplete: !(readiness?.issues || []).some((i: string) => i.includes("SBP") || i.includes("PRC")),
      warnings: (readiness?.issues || []).filter((i: string) => i.includes("SBP") || i.includes("PRC"))
    },
    {
      id: "wealth",
      title: "Wealth Reconciliation",
      description: "Ensure declared assets match income and expenses.",
      isComplete: wealth?.reconciled || false,
      warnings: wealth?.reconciled ? [] : [`Wealth gap of Rs. ${Math.abs(wealth?.differencePKR || 0).toLocaleString()} detected`]
    }
  ]

  const completedSteps = steps.filter(s => s.isComplete).length
  const totalSteps = steps.length
  const percentComplete = (completedSteps / totalSteps) * 100
  const isReady = completedSteps === totalSteps

  const totalWarnings = steps.reduce((sum, step) => sum + step.warnings.length, 0)

  return (
    <div id="simulator-dashboard" className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Filing Simulator</h1>
          <p className="text-muted-foreground mt-1">A guided walkthrough of your FBR tax return preparation.</p>
        </div>
        <div className="flex gap-4 items-center">
          <Select value={taxYear} onValueChange={setTaxYear}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tax Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">Tax Year 2024</SelectItem>
              <SelectItem value="2025">Tax Year 2025</SelectItem>
              <SelectItem value="2026">Tax Year 2026</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

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
                  {totalWarnings} unresolved {totalWarnings === 1 ? 'issue' : 'issues'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                  <CheckCircle2 className="h-5 w-5" />
                  Ready to file
                </span>
              )}
            </div>
          </div>
          <Progress 
            value={percentComplete} 
            className="h-3" 
            indicatorClassName={isReady ? "bg-emerald-500" : "bg-primary"}
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {steps.map((step, index) => (
          <Card key={step.id} className={`transition-all ${step.isComplete ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-border'}`}>
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
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    {!step.isComplete && step.id === 'wealth' && (
                      <Button variant="link" size="sm" asChild>
                        <a href="/wealth">Go to Wealth Reconciler</a>
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

      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardContent className="p-8 text-center space-y-4">
          <FileText className="h-12 w-12 text-primary mx-auto opacity-80" />
          <h2 className="text-2xl font-bold">Generate Filing Package</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Once all steps are complete, you can generate your final FBR tax package containing your consolidated tax summary, income ledger, and expense reports.
          </p>
          <Button 
            size="lg" 
            disabled={!isReady || isGenerating}
            onClick={() => generatePackage("simulator-dashboard", taxYear)}
            className="mt-4"
          >
            {isGenerating ? "Compiling Package..." : (
              <>
                <Download className="mr-2 h-5 w-5" />
                Download Tax Package (ZIP)
              </>
            )}
          </Button>
          {!isReady && (
            <p className="text-sm text-amber-600 font-medium">
              Please resolve all outstanding issues to enable export.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

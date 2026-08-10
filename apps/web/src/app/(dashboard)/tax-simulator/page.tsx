"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSimulateTax, useTaxEstimate } from "@/hooks/use-tax";
import { formatPKR, apiErrorMessage } from "@/lib/utils";
import { Calculator, TrendingUp, TrendingDown, Activity, Percent, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getCurrentTaxYear } from "@/lib/tax-year";

export default function TaxSimulatorPage() {
  const [exportIncomePKR, setExportIncomePKR] = useState("");
  const [localIncomePKR, setLocalIncomePKR] = useState("");
  const [expensesPKR, setExpensesPKR] = useState("");
  const [isPseb, setIsPseb] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only the loading flag is used below (as a guard before the simulation's
  // own `current` figures are available); the estimate itself is unused here
  // since the simulation response already returns its own `current` snapshot.
  const { isLoading: isCurrentLoading } = useTaxEstimate(getCurrentTaxYear(), isPseb);
  const simulateMutation = useSimulateTax();

  const handleSimulate = () => {
    setError(null);
    const income = Number((exportIncomePKR || "0").replace(/,/g, ""));
    const local = Number((localIncomePKR || "0").replace(/,/g, ""));
    const expenses = Number((expensesPKR || "0").replace(/,/g, ""));

    if (income <= 0 && local <= 0) {
      setError("Enter an export or local income figure to simulate.");
      return;
    }

    simulateMutation.mutate(
      { incomePKR: income, localIncomePKR: local, expensesPKR: expenses, year: getCurrentTaxYear(), pseb: isPseb },
      { onError: (err) => setError(apiErrorMessage(err, "Could not run the simulation.")) },
    );
  };

  const simulationResult = simulateMutation.data;

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 md:px-0 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Calculator className="h-8 w-8 text-primary" /> Tax Scenario Simulator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            &quot;What if?&quot; See how changes in income or PSEB registration impact your tax liability.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-5 space-y-6">
          <Card className="rounded-3xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle>Simulation Inputs</CardTitle>
              <CardDescription>Enter hypothetical figures to forecast your taxes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label>Hypothetical Export Income (PKR)</Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Foreign/platform income taxed under s.154A — never reduced by expenses.
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Rs</span>
                  <Input
                    type="number"
                    placeholder="e.g. 15000000"
                    className="pl-10 rounded-xl"
                    value={exportIncomePKR}
                    onChange={(e) => setExportIncomePKR(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Hypothetical Local Income (PKR)</Label>
                <p className="text-xs text-muted-foreground -mt-1">Taxed on the normal slabs; expenses are deductible against this.</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Rs</span>
                  <Input
                    type="number"
                    placeholder="e.g. 2000000"
                    className="pl-10 rounded-xl"
                    value={localIncomePKR}
                    onChange={(e) => setLocalIncomePKR(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Hypothetical Annual Expenses (PKR)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Rs</span>
                  <Input
                    type="number"
                    placeholder="e.g. 500000"
                    className="pl-10 rounded-xl"
                    value={expensesPKR}
                    onChange={(e) => setExpensesPKR(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50">
                <div className="space-y-0.5">
                  <Label>PSEB Registered</Label>
                  <p className="text-xs text-muted-foreground">Applies 0.25% vs 1% rate on exports.</p>
                </div>
                <Switch checked={isPseb} onCheckedChange={setIsPseb} />
              </div>

              <Button
                className="w-full rounded-xl shadow-sm h-12 text-md font-semibold"
                onClick={handleSimulate}
                disabled={simulateMutation.isPending || (!exportIncomePKR && !localIncomePKR)}
              >
                {simulateMutation.isPending ? "Calculating..." : "Run Simulation"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-7">
          {!simulationResult ? (
            <Card className="h-full min-h-[400px] rounded-3xl border-dashed bg-muted/20 flex flex-col items-center justify-center text-center p-8">
              <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                <Activity className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-lg text-foreground mb-2">Ready for Simulation</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Enter your hypothetical figures on the left and run the simulation to see how your tax liability would change.
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="rounded-3xl border-border/50 shadow-sm relative overflow-hidden bg-background">
                  <div className="absolute top-0 left-0 w-full h-1 bg-muted-foreground/30"></div>
                  <CardContent className="p-6">
                    <p className="text-sm font-bold text-muted-foreground mb-1 uppercase tracking-wider">Current Trajectory</p>
                    <div className="text-2xl font-black font-mono text-foreground mb-4">
                      {isCurrentLoading ? "…" : formatPKR(simulationResult.current.taxPKR)}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Income:</span>
                        <span className="font-mono text-foreground">{formatPKR(simulationResult.current.incomePKR)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Expenses:</span>
                        <span className="font-mono text-foreground">{formatPKR(simulationResult.current.expensesPKR)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-primary/20 shadow-sm relative overflow-hidden bg-primary/5">
                  <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
                  <CardContent className="p-6">
                    <p className="text-sm font-bold text-primary mb-1 uppercase tracking-wider">Simulated Future</p>
                    <div className="text-2xl font-black font-mono text-primary mb-4">
                      {formatPKR(simulationResult.scenario.taxPKR)}
                    </div>
                    <div className="space-y-1 text-xs text-primary/80">
                      <div className="flex justify-between">
                        <span>Export tax:</span>
                        <span className="font-mono text-primary font-bold">{formatPKR(simulationResult.scenario.exportTaxPKR)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Local tax:</span>
                        <span className="font-mono text-primary font-bold">{formatPKR(simulationResult.scenario.localTaxPKR)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Expenses:</span>
                        <span className="font-mono text-primary font-bold">{formatPKR(simulationResult.scenario.expensesPKR)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className={`rounded-3xl border-border/50 shadow-sm overflow-hidden ${simulationResult.differencePKR <= 0 ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
                <CardContent className="p-8 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold mb-1">
                      {simulationResult.differencePKR <= 0 ? "Tax Decrease" : "Tax Increase"} vs Current
                    </p>
                    <h2 className={`text-3xl font-black font-mono ${simulationResult.differencePKR <= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                      {simulationResult.differencePKR <= 0 ? "-" : "+"}{formatPKR(Math.abs(simulationResult.differencePKR))}
                    </h2>
                  </div>
                  <div className={`h-16 w-16 rounded-full flex items-center justify-center shadow-inner ${simulationResult.differencePKR <= 0 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                    {simulationResult.differencePKR <= 0 ? <TrendingDown className="h-8 w-8" /> : <TrendingUp className="h-8 w-8" />}
                  </div>
                </CardContent>
              </Card>

              <div className="p-4 rounded-2xl bg-muted/50 border border-border/50 flex items-start gap-3">
                <Percent className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Export income is taxed at <strong>{isPseb ? "0.25%" : "1.0%"}</strong> on the gross amount under Section 154A —
                  expenses never reduce it. Local income is taxed on the normal slabs after deducting your expenses.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

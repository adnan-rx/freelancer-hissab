"use client";

import { useState } from "react";
import { Activity, AlertCircle, Calculator, Loader2, TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useSimulateTax, useTaxEstimate } from "@/hooks/use-tax";
import { formatPKR, apiErrorMessage } from "@/lib/utils";
import { getCurrentTaxYear, taxYearLabel } from "@/lib/tax-year";

/** PKR-prefixed number field — the same treatment on all three inputs. */
function AmountInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground"
        aria-hidden="true"
      >
        Rs
      </span>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        placeholder={placeholder}
        className="pl-10 font-mono tabular-nums"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

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
  const isSaving = simulateMutation.isPending;
  const isDecrease = simulationResult ? simulationResult.differencePKR <= 0 : false;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="Tax simulator"
        description={`See how a change in income, expenses or PSEB registration would move your liability for tax year ${taxYearLabel(getCurrentTaxYear())}.`}
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <Card className="lg:col-span-5">
          <CardToolbar>
            <div className="space-y-1">
              <CardTitle>Scenario</CardTitle>
              <CardDescription>Hypothetical figures — nothing here is saved.</CardDescription>
            </div>
          </CardToolbar>

          <CardContent className="space-y-5 pt-5 sm:pt-6">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-destructive/15 bg-destructive-surface p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <Field
              label="Export income"
              htmlFor="sim-export"
              hint="Foreign and platform income taxed under s.154A. Expenses never reduce it."
            >
              <AmountInput id="sim-export" value={exportIncomePKR} onChange={setExportIncomePKR} placeholder="15000000" />
            </Field>

            <Field
              label="Local income"
              htmlFor="sim-local"
              hint="Taxed on the normal slabs, after deducting expenses."
            >
              <AmountInput id="sim-local" value={localIncomePKR} onChange={setLocalIncomePKR} placeholder="2000000" />
            </Field>

            <Field label="Annual expenses" htmlFor="sim-expenses">
              <AmountInput id="sim-expenses" value={expensesPKR} onChange={setExpensesPKR} placeholder="500000" />
            </Field>

            <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/50 p-4">
              <div className="space-y-0.5">
                <Label htmlFor="sim-pseb">PSEB registered</Label>
                <p className="text-xs text-muted-foreground">Applies 0.25% instead of 1% on exports.</p>
              </div>
              <Switch id="sim-pseb" checked={isPseb} onCheckedChange={setIsPseb} />
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleSimulate}
              disabled={isSaving || (!exportIncomePKR && !localIncomePKR)}
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" /> Calculating…
                </>
              ) : (
                <>
                  <Calculator /> Run simulation
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-7">
          {!simulationResult ? (
            <Card className="flex h-full min-h-[22rem] items-center justify-center border-dashed bg-transparent shadow-none">
              <EmptyState
                icon={Activity}
                title="Nothing simulated yet"
                description="Fill in the figures on the left and run the simulation to compare it against where you stand today."
              />
            </Card>
          ) : (
            <div className="space-y-4 lg:space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="overflow-hidden">
                  <span className="block h-1 w-full bg-border-strong" aria-hidden="true" />
                  <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
                    <p className="text-sm font-medium text-muted-foreground">Where you are now</p>
                    <p className="mt-3 font-mono text-2xl font-semibold tracking-[-0.03em] tabular-nums text-foreground">
                      {isCurrentLoading ? "…" : formatPKR(simulationResult.current.taxPKR)}
                    </p>
                    <dl className="mt-4 space-y-1.5 text-xs">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Income</dt>
                        <dd className="font-mono tabular-nums text-foreground">
                          {formatPKR(simulationResult.current.incomePKR)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Expenses</dt>
                        <dd className="font-mono tabular-nums text-foreground">
                          {formatPKR(simulationResult.current.expensesPKR)}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-brand-200 bg-brand-50/50">
                  <span className="block h-1 w-full bg-primary" aria-hidden="true" />
                  <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
                    <p className="text-sm font-medium text-brand-800">Under this scenario</p>
                    <p className="mt-3 font-mono text-2xl font-semibold tracking-[-0.03em] tabular-nums text-brand-900">
                      {formatPKR(simulationResult.scenario.taxPKR)}
                    </p>
                    <dl className="mt-4 space-y-1.5 text-xs">
                      <div className="flex justify-between gap-3">
                        <dt className="text-brand-700">Export tax</dt>
                        <dd className="font-mono font-medium tabular-nums text-brand-900">
                          {formatPKR(simulationResult.scenario.exportTaxPKR)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-brand-700">Local tax</dt>
                        <dd className="font-mono font-medium tabular-nums text-brand-900">
                          {formatPKR(simulationResult.scenario.localTaxPKR)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-brand-700">Expenses</dt>
                        <dd className="font-mono font-medium tabular-nums text-brand-900">
                          {formatPKR(simulationResult.scenario.expensesPKR)}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </div>

              <Card className={isDecrease ? "border-success/20 bg-success-surface" : "border-warning/20 bg-warning-surface"}>
                <CardContent className="flex items-center justify-between gap-4 p-6 pt-6">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {isDecrease ? "Less tax than today" : "More tax than today"}
                    </p>
                    <p
                      className={`mt-1.5 font-mono text-3xl font-semibold tracking-[-0.03em] tabular-nums ${
                        isDecrease ? "text-success" : "text-warning"
                      }`}
                    >
                      {isDecrease ? "−" : "+"}
                      {formatPKR(Math.abs(simulationResult.differencePKR))}
                    </p>
                  </div>
                  <span
                    className={`flex size-12 shrink-0 items-center justify-center rounded-md ${
                      isDecrease ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"
                    }`}
                    aria-hidden="true"
                  >
                    {isDecrease ? <TrendingDown className="size-6" /> : <TrendingUp className="size-6" />}
                  </span>
                </CardContent>
              </Card>

              <p className="rounded-md border border-border bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">
                Export income is taxed at <strong className="font-medium text-foreground">{isPseb ? "0.25%" : "1.0%"}</strong>{" "}
                on the gross amount under Section 154A — expenses never reduce it. Local income is taxed on the normal
                slabs after your expenses are deducted.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

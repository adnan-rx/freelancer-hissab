"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuthStore } from "@/stores/auth.store"

export default function WealthPage() {
  const token = useAuthStore((state) => state.accessToken)
  const [loading, setLoading] = useState(true)
  const [taxYear, setTaxYear] = useState("2026")
  
  const [statement, setStatement] = useState<any>(null)
  const [assets, setAssets] = useState<any[]>([])
  const [liabilities, setLiabilities] = useState<any[]>([])
  const [reconciliation, setReconciliation] = useState<any>(null)

  // Forms
  const [openingWealth, setOpeningWealth] = useState("")
  
  const [newAsset, setNewAsset] = useState({ type: "CASH", description: "", valuePKR: "" })
  const [newLiability, setNewLiability] = useState({ description: "", amountPKR: "" })

  const fetchData = async () => {
    if (!token) return
    try {
      setLoading(true)
      const headers = { Authorization: `Bearer ${token}` }
      
      const [stmtRes, assetsRes, liabRes, reconRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/wealth/statement?year=${taxYear}`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/wealth/assets?year=${taxYear}`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/wealth/liabilities?year=${taxYear}`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/wealth/reconciliation?year=${taxYear}`, { headers }),
      ])

      const stmtData = await stmtRes.json()
      const assetsData = await assetsRes.json()
      const liabData = await liabRes.json()
      const reconData = await reconRes.json()

      setStatement(stmtData?.data || stmtData)
      setAssets(Array.isArray(assetsData?.data) ? assetsData.data : Array.isArray(assetsData) ? assetsData : [])
      setLiabilities(Array.isArray(liabData?.data) ? liabData.data : Array.isArray(liabData) ? liabData : [])
      setReconciliation(reconData?.data || reconData)
      setOpeningWealth(stmtData?.data?.openingWealthPKR || stmtData?.openingWealthPKR || "")
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [token, taxYear])

  const updateOpeningWealth = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/wealth/statement?year=${taxYear}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ openingWealthPKR: Number(openingWealth) })
      })
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const addAsset = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/wealth/assets`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          taxYear,
          type: newAsset.type,
          description: newAsset.description,
          valuePKR: Number(newAsset.valuePKR)
        })
      })
      setNewAsset({ type: "CASH", description: "", valuePKR: "" })
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const deleteAsset = async (id: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/wealth/assets/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const addLiability = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/wealth/liabilities`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          taxYear,
          description: newLiability.description,
          amountPKR: Number(newLiability.amountPKR)
        })
      })
      setNewLiability({ description: "", amountPKR: "" })
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const deleteLiability = async (id: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/wealth/liabilities/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const formatCurrency = (val: number | string) => {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(val))
  }

  if (loading) return <div className="p-8">Loading wealth data...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wealth Reconciliation</h1>
          <p className="text-muted-foreground mt-1">Declare your assets and verify they match your reported income.</p>
        </div>
        <Select value={taxYear} onValueChange={setTaxYear}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Tax Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2024">Tax Year 2024</SelectItem>
            <SelectItem value="2025">Tax Year 2025</SelectItem>
            <SelectItem value="2026">Tax Year 2026</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {reconciliation && (
        <Card className={`border-2 ${reconciliation.reconciled ? "border-emerald-500/50" : "border-destructive/50"}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  {reconciliation.reconciled ? (
                    <><CheckCircle2 className="text-emerald-500 h-6 w-6" /> Wealth Reconciled</>
                  ) : (
                    <><XCircle className="text-destructive h-6 w-6" /> Wealth Mismatch</>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                  {reconciliation.reconciled 
                    ? "Your declared assets perfectly align with your reported income and expenses for this tax year."
                    : `Your declared net wealth is off by ${formatCurrency(Math.abs(reconciliation.differencePKR))} compared to what your income minus expenses implies. FBR allows a variance of up to ${formatCurrency(reconciliation.toleranceThresholdPKR)}.`
                  }
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Expected Closing Wealth</div>
                <div className="text-2xl font-bold font-mono">{formatCurrency(reconciliation.expectedClosingWealthPKR)}</div>
                <div className="text-sm text-muted-foreground mt-2">Declared Net Wealth</div>
                <div className="text-2xl font-bold font-mono">{formatCurrency(reconciliation.netDeclaredWealthPKR)}</div>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-border flex justify-between text-sm text-muted-foreground">
              <div>Opening: {formatCurrency(reconciliation.openingWealthPKR)}</div>
              <div className="text-emerald-600">+ Income: {formatCurrency(reconciliation.totalIncomePKR)}</div>
              <div className="text-rose-600">- Expenses: {formatCurrency(reconciliation.totalExpensesPKR)}</div>
              <div>= Expected: {formatCurrency(reconciliation.expectedClosingWealthPKR)}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Opening Wealth</CardTitle>
              <CardDescription>Net wealth carried forward from the previous tax year.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <div className="space-y-2 flex-1">
                  <Label>Opening Balance (PKR)</Label>
                  <Input 
                    type="number" 
                    value={openingWealth} 
                    onChange={e => setOpeningWealth(e.target.value)} 
                    onBlur={updateOpeningWealth}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assets ({formatCurrency(reconciliation?.declaredAssetsPKR || 0)})</CardTitle>
              <CardDescription>What you own (Cash, Property, Vehicles, etc.)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assets.map(asset => (
                  <div key={asset.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium text-sm">{asset.description}</div>
                      <div className="text-xs text-muted-foreground">{asset.type}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm">{formatCurrency(asset.valuePKR)}</span>
                      <Button variant="ghost" size="icon" onClick={() => deleteAsset(asset.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {assets.length === 0 && <p className="text-sm text-muted-foreground">No assets declared yet.</p>}
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 pt-6">
              <form onSubmit={addAsset} className="w-full flex items-end gap-3">
                <div className="w-[120px]">
                  <Label className="mb-2 block text-xs">Type</Label>
                  <Select value={newAsset.type} onValueChange={(val) => setNewAsset({...newAsset, type: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash / Bank</SelectItem>
                      <SelectItem value="PROPERTY">Property</SelectItem>
                      <SelectItem value="VEHICLE">Vehicle</SelectItem>
                      <SelectItem value="INVESTMENT">Investment</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="mb-2 block text-xs">Description</Label>
                  <Input required value={newAsset.description} onChange={e => setNewAsset({...newAsset, description: e.target.value})} placeholder="e.g. Meezan Bank" />
                </div>
                <div className="w-[130px]">
                  <Label className="mb-2 block text-xs">Value (PKR)</Label>
                  <Input required type="number" value={newAsset.valuePKR} onChange={e => setNewAsset({...newAsset, valuePKR: e.target.value})} />
                </div>
                <Button type="submit" size="icon"><Plus className="h-4 w-4" /></Button>
              </form>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Liabilities ({formatCurrency(reconciliation?.declaredLiabilitiesPKR || 0)})</CardTitle>
              <CardDescription>What you owe (Loans, Mortgages, etc.)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {liabilities.map(liab => (
                  <div key={liab.id} className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                    <div className="font-medium text-sm">{liab.description}</div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm text-destructive">{formatCurrency(liab.amountPKR)}</span>
                      <Button variant="ghost" size="icon" onClick={() => deleteLiability(liab.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {liabilities.length === 0 && <p className="text-sm text-muted-foreground">No liabilities declared yet.</p>}
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 pt-6">
              <form onSubmit={addLiability} className="w-full flex items-end gap-3">
                <div className="flex-1">
                  <Label className="mb-2 block text-xs">Description</Label>
                  <Input required value={newLiability.description} onChange={e => setNewLiability({...newLiability, description: e.target.value})} placeholder="e.g. Car Loan" />
                </div>
                <div className="w-[150px]">
                  <Label className="mb-2 block text-xs">Amount (PKR)</Label>
                  <Input required type="number" value={newLiability.amountPKR} onChange={e => setNewLiability({...newLiability, amountPKR: e.target.value})} />
                </div>
                <Button type="submit" size="icon"><Plus className="h-4 w-4" /></Button>
              </form>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}

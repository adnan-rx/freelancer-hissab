"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, CheckCircle2, XCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useAuthStore } from "@/stores/auth.store"
import { apiClient } from "@/lib/api-client"

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
  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false)
  const [isLiabilityDialogOpen, setIsLiabilityDialogOpen] = useState(false)
  
  const [newAsset, setNewAsset] = useState({ type: "CASH", description: "", valuePKR: "", name: "", currency: "PKR", balance: "" })
  const [newLiability, setNewLiability] = useState({ description: "", amountPKR: "" })

  const fetchData = async () => {
    if (!token) return
    try {
      setLoading(true)
      
      const [stmtRes, assetsRes, liabRes, reconRes] = await Promise.all([
        apiClient.get(`/wealth/statement?year=${taxYear}`),
        apiClient.get(`/wealth/assets?year=${taxYear}`),
        apiClient.get(`/wealth/liabilities?year=${taxYear}`),
        apiClient.get(`/wealth/reconciliation?year=${taxYear}`),
      ])

      const stmtData = stmtRes.data
      const assetsData = assetsRes.data
      const liabData = liabRes.data
      const reconData = reconRes.data

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
      await apiClient.patch(`/wealth/statement?year=${taxYear}`, {
        openingWealthPKR: Number(openingWealth)
      })
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const addAsset = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.post(`/wealth/assets`, {
        taxYear,
        type: newAsset.type,
        name: newAsset.name,
        currency: newAsset.currency,
        balance: Number(newAsset.balance),
        description: newAsset.description,
        valuePKR: Number(newAsset.valuePKR)
      })
      setNewAsset({ type: "CASH", description: "", valuePKR: "", name: "", currency: "PKR", balance: "" })
      setIsAssetDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const deleteAsset = async (id: string) => {
    try {
      await apiClient.delete(`/wealth/assets/${id}`)
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const addLiability = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.post(`/wealth/liabilities`, {
        taxYear,
        description: newLiability.description,
        amountPKR: Number(newLiability.amountPKR)
      })
      setNewLiability({ description: "", amountPKR: "" })
      setIsLiabilityDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const deleteLiability = async (id: string) => {
    try {
      await apiClient.delete(`/wealth/liabilities/${id}`)
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const formatCurrency = (val: number | string | undefined) => {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(val || 0))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p>Loading wealth data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wealth Management</h1>
          <p className="text-muted-foreground mt-1">Manage your assets, liabilities, and reconcile your wealth for FBR compliance.</p>
        </div>
        <div className="w-full sm:w-[200px]">
          <Label className="mb-2 block text-sm">Tax Year</Label>
          <Select value={taxYear} onValueChange={setTaxYear}>
            <SelectTrigger>
              <SelectValue placeholder="Select Tax Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">Tax Year 2024</SelectItem>
              <SelectItem value="2025">Tax Year 2025</SelectItem>
              <SelectItem value="2026">Tax Year 2026</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Primary Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(reconciliation?.declaredAssetsPKR)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Liabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{formatCurrency(reconciliation?.declaredLiabilitiesPKR)}</div>
          </CardContent>
        </Card>
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/80">Net Declared Wealth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(reconciliation?.netDeclaredWealthPKR)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation Section */}
      {reconciliation && (
        <Card className={`border-l-4 shadow-sm ${reconciliation.reconciled ? "border-l-emerald-500" : "border-l-destructive"}`}>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  {reconciliation.reconciled ? (
                    <><CheckCircle2 className="text-emerald-500 h-6 w-6" /> Wealth Reconciled</>
                  ) : (
                    <><XCircle className="text-destructive h-6 w-6" /> Wealth Mismatch</>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xl">
                  {reconciliation.reconciled 
                    ? "Your declared assets perfectly align with your reported income and expenses for this tax year."
                    : `Your declared net wealth is off by ${formatCurrency(Math.abs(reconciliation.differencePKR))} compared to what your income minus expenses implies. FBR allows a variance of up to ${formatCurrency(reconciliation.toleranceThresholdPKR)}.`
                  }
                </p>
              </div>

              <div className="flex gap-4 sm:gap-8 bg-muted/30 p-4 rounded-xl border items-center justify-center min-w-[300px]">
                <div className="text-center">
                  <div className="text-xs uppercase font-semibold text-muted-foreground mb-1">Expected</div>
                  <div className="text-xl font-bold font-mono">{formatCurrency(reconciliation.expectedClosingWealthPKR)}</div>
                </div>
                <div className="text-xl text-muted-foreground font-light">=</div>
                <div className="text-center">
                  <div className="text-xs uppercase font-semibold text-muted-foreground mb-1">Declared</div>
                  <div className="text-xl font-bold font-mono">{formatCurrency(reconciliation.netDeclaredWealthPKR)}</div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Formula:</span>
              <span>Opening: <strong className="text-foreground">{formatCurrency(reconciliation.openingWealthPKR)}</strong></span>
              <span className="text-emerald-600 font-medium">+ Income: {formatCurrency(reconciliation.totalIncomePKR)}</span>
              <span className="text-rose-600 font-medium">- Expenses: {formatCurrency(reconciliation.totalExpensesPKR)}</span>
              <span>= Expected: <strong className="text-foreground">{formatCurrency(reconciliation.expectedClosingWealthPKR)}</strong></span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Opening Wealth Input */}
      <Card>
        <CardHeader>
          <CardTitle>Opening Wealth</CardTitle>
          <CardDescription>Net wealth carried forward from the previous tax year.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-sm flex-col gap-2">
            <Label htmlFor="opening-wealth">Opening Balance (PKR)</Label>
            <Input 
              id="opening-wealth"
              type="number" 
              value={openingWealth} 
              onChange={e => setOpeningWealth(e.target.value)} 
              onBlur={updateOpeningWealth}
              placeholder="e.g. 500000"
            />
          </div>
        </CardContent>
      </Card>

      {/* Assets and Liabilities Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Assets Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Assets</h2>
              <p className="text-sm text-muted-foreground">What you own</p>
            </div>
            <Dialog open={isAssetDialogOpen} onOpenChange={setIsAssetDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Add Asset</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Asset</DialogTitle>
                  <DialogDescription>
                    Declare a new asset to include in your wealth statement.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={addAsset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="asset-name">Asset Name *</Label>
                    <Input id="asset-name" required value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} placeholder="e.g. Meezan Bank Current Acc" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="asset-type">Asset Type</Label>
                    <Select value={newAsset.type} onValueChange={(val) => setNewAsset({...newAsset, type: val})}>
                      <SelectTrigger id="asset-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Cash / Bank</SelectItem>
                        <SelectItem value="PROPERTY">Property</SelectItem>
                        <SelectItem value="VEHICLE">Vehicle</SelectItem>
                        <SelectItem value="INVESTMENT">Investment</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="asset-balance">Current Balance *</Label>
                      <Input id="asset-balance" required type="number" value={newAsset.balance} onChange={e => setNewAsset({...newAsset, balance: e.target.value})} placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="asset-currency">Currency</Label>
                      <Select value={newAsset.currency} onValueChange={(val) => setNewAsset({...newAsset, currency: val})}>
                        <SelectTrigger id="asset-currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PKR">PKR (Rs.)</SelectItem>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="USDT">USDT</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="asset-val">Value (PKR) *</Label>
                    <Input id="asset-val" required type="number" value={newAsset.valuePKR} onChange={e => setNewAsset({...newAsset, valuePKR: e.target.value})} placeholder="0" />
                    {newAsset.currency !== 'PKR' && (
                      <p className="text-[11px] text-muted-foreground">Enter the equivalent PKR value for FBR reconciliation.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="asset-desc">Notes</Label>
                    <Input id="asset-desc" value={newAsset.description} onChange={e => setNewAsset({...newAsset, description: e.target.value})} placeholder="Optional notes (e.g. Primary checking account)" />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save Asset</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Asset Type</TableHead>
                  <TableHead className="text-right">Current Balance</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      No assets declared yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  assets.map(asset => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">{asset.name || asset.description}</TableCell>
                      <TableCell className="text-muted-foreground text-xs capitalize">{(asset.type || "").toLowerCase()}</TableCell>
                      <TableCell className="text-right font-mono">
                        {asset.currency === 'PKR' ? formatCurrency(asset.balance || asset.valuePKR) : new Intl.NumberFormat('en-US').format(Number(asset.balance || 0))}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{asset.currency || "PKR"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{asset.description}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteAsset(asset.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Liabilities Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Liabilities</h2>
              <p className="text-sm text-muted-foreground">What you owe</p>
            </div>
            <Dialog open={isLiabilityDialogOpen} onOpenChange={setIsLiabilityDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-2" /> Add Liability</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Liability</DialogTitle>
                  <DialogDescription>
                    Declare a new liability or loan.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={addLiability} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="liab-desc">Description</Label>
                    <Input id="liab-desc" required value={newLiability.description} onChange={e => setNewLiability({...newLiability, description: e.target.value})} placeholder="e.g. Car Loan" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="liab-val">Amount (PKR)</Label>
                    <Input id="liab-val" required type="number" value={newLiability.amountPKR} onChange={e => setNewLiability({...newLiability, amountPKR: e.target.value})} placeholder="0" />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save Liability</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liabilities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                      No liabilities declared yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  liabilities.map(liab => (
                    <TableRow key={liab.id}>
                      <TableCell className="font-medium">{liab.description}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">{formatCurrency(liab.amountPKR)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteLiability(liab.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, Landmark, Loader2, Plus, Trash2, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import { PaginationBar } from "@/components/ui/pagination-bar"
import { BulkActionsBar } from "@/components/ui/bulk-actions-bar"
import { ConfirmModal } from "@/components/ui/confirm-modal"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton"
import { useToast } from "@/providers/toast-provider"
import { useAuthStore } from "@/stores/auth.store"
import { apiClient } from "@/lib/api-client"
import { apiErrorMessage, formatPKR } from "@/lib/utils"
import { useDataTable } from "@/hooks/use-data-table"
import { getCurrentTaxYear, taxYearOptions } from "@/lib/tax-year"

export default function WealthPage() {
  const token = useAuthStore((state) => state.accessToken)
  const [loading, setLoading] = useState(true)
  const [taxYear, setTaxYear] = useState(() => String(getCurrentTaxYear()))

  const [assets, setAssets] = useState<any[]>([])
  const [liabilities, setLiabilities] = useState<any[]>([])
  const [reconciliation, setReconciliation] = useState<any>(null)

  // Forms
  const [openingWealth, setOpeningWealth] = useState("")
  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false)
  const [isLiabilityDialogOpen, setIsLiabilityDialogOpen] = useState(false)
  const [isSavingAsset, setIsSavingAsset] = useState(false)
  const [isSavingLiability, setIsSavingLiability] = useState(false)

  const [newAsset, setNewAsset] = useState({ type: "CASH", description: "", valuePKR: "", name: "", currency: "PKR", balance: "" })
  const [newLiability, setNewLiability] = useState({ description: "", amountPKR: "" })

  const { showSuccess, showError } = useToast()
  const [deleteAssetTarget, setDeleteAssetTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteLiabilityTarget, setDeleteLiabilityTarget] = useState<{ id: string; description: string } | null>(null)
  const [bulkAssetConfirmOpen, setBulkAssetConfirmOpen] = useState(false)
  const [isBulkDeletingAssets, setIsBulkDeletingAssets] = useState(false)
  const [bulkLiabilityConfirmOpen, setBulkLiabilityConfirmOpen] = useState(false)
  const [isBulkDeletingLiabilities, setIsBulkDeletingLiabilities] = useState(false)

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

      setAssets(Array.isArray(assetsData?.data) ? assetsData.data : Array.isArray(assetsData) ? assetsData : [])
      setLiabilities(Array.isArray(liabData?.data) ? liabData.data : Array.isArray(liabData) ? liabData : [])
      setReconciliation(reconData?.data || reconData)
      setOpeningWealth(stmtData?.data?.openingWealthPKR || stmtData?.openingWealthPKR || "")
    } catch (error) {
      // Every write below already reports its own success/failure; this is
      // the initial page load, so a failure here means the whole page has
      // nothing to show — worth a toast rather than a silently blank screen.
      showError(apiErrorMessage(error, "Could not load your wealth data."), "Couldn't load wealth data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, taxYear])

  const updateOpeningWealth = async () => {
    try {
      await apiClient.patch(`/wealth/statement?year=${taxYear}`, {
        openingWealthPKR: Number(openingWealth)
      })
      showSuccess("Opening wealth updated.", "Saved")
      fetchData()
    } catch (error) {
      showError(apiErrorMessage(error, "Failed to update opening wealth."), "Couldn't save")
    }
  }

  const addAsset = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingAsset(true)
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
      showSuccess(`"${newAsset.name}" added.`, "Asset added")
      setNewAsset({ type: "CASH", description: "", valuePKR: "", name: "", currency: "PKR", balance: "" })
      setIsAssetDialogOpen(false)
      fetchData()
    } catch (error) {
      showError(apiErrorMessage(error, "Failed to save the asset."), "Couldn't save asset")
    } finally {
      setIsSavingAsset(false)
    }
  }

  const handleConfirmDeleteAsset = async () => {
    if (!deleteAssetTarget) return
    try {
      await apiClient.delete(`/wealth/assets/${deleteAssetTarget.id}`)
      showSuccess(`"${deleteAssetTarget.name}" removed.`, "Asset deleted")
      fetchData()
    } catch (error) {
      showError(apiErrorMessage(error, "Failed to delete the asset."), "Couldn't delete asset")
    } finally {
      setDeleteAssetTarget(null)
    }
  }

  const assetsTable = useDataTable(assets, {
    getId: (a: any) => a.id,
    sortAccessors: {
      name: (a: any) => (a.name || a.description || "").toLowerCase(),
      type: (a: any) => (a.type || "").toLowerCase(),
      balance: (a: any) => Number(a.balance || a.valuePKR || 0),
      currency: (a: any) => (a.currency || "").toLowerCase(),
    },
  })

  const handleBulkDeleteAssets = async () => {
    const ids = Array.from(assetsTable.selected)
    setIsBulkDeletingAssets(true)
    const results = await Promise.allSettled(ids.map((id) => apiClient.delete(`/wealth/assets/${id}`)))
    setIsBulkDeletingAssets(false)
    setBulkAssetConfirmOpen(false)
    assetsTable.clearSelection()
    await fetchData()

    const failed = results.filter((r) => r.status === "rejected").length
    const deleted = ids.length - failed
    if (failed === 0) {
      showSuccess(`${deleted} asset${deleted === 1 ? "" : "s"} removed.`, "Assets deleted")
    } else {
      showError(`${deleted} deleted, ${failed} could not be removed.`, "Some deletes failed")
    }
  }

  const addLiability = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingLiability(true)
    try {
      await apiClient.post(`/wealth/liabilities`, {
        taxYear,
        description: newLiability.description,
        amountPKR: Number(newLiability.amountPKR)
      })
      showSuccess(`"${newLiability.description}" added.`, "Liability added")
      setNewLiability({ description: "", amountPKR: "" })
      setIsLiabilityDialogOpen(false)
      fetchData()
    } catch (error) {
      showError(apiErrorMessage(error, "Failed to save the liability."), "Couldn't save liability")
    } finally {
      setIsSavingLiability(false)
    }
  }

  const handleConfirmDeleteLiability = async () => {
    if (!deleteLiabilityTarget) return
    try {
      await apiClient.delete(`/wealth/liabilities/${deleteLiabilityTarget.id}`)
      showSuccess(`"${deleteLiabilityTarget.description}" removed.`, "Liability deleted")
      fetchData()
    } catch (error) {
      showError(apiErrorMessage(error, "Failed to delete the liability."), "Couldn't delete liability")
    } finally {
      setDeleteLiabilityTarget(null)
    }
  }

  const liabilitiesTable = useDataTable(liabilities, {
    getId: (l: any) => l.id,
    sortAccessors: {
      description: (l: any) => (l.description || "").toLowerCase(),
      amount: (l: any) => Number(l.amountPKR || 0),
    },
  })

  const handleBulkDeleteLiabilities = async () => {
    const ids = Array.from(liabilitiesTable.selected)
    setIsBulkDeletingLiabilities(true)
    const results = await Promise.allSettled(ids.map((id) => apiClient.delete(`/wealth/liabilities/${id}`)))
    setIsBulkDeletingLiabilities(false)
    setBulkLiabilityConfirmOpen(false)
    liabilitiesTable.clearSelection()
    await fetchData()

    const failed = results.filter((r) => r.status === "rejected").length
    const deleted = ids.length - failed
    if (failed === 0) {
      showSuccess(`${deleted} liabilit${deleted === 1 ? "y" : "ies"} removed.`, "Liabilities deleted")
    } else {
      showError(`${deleted} deleted, ${failed} could not be removed.`, "Some deletes failed")
    }
  }

  const isReconciled = !!reconciliation?.reconciled

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="Wealth"
        description="Assets, liabilities and the reconciliation FBR expects between your declared wealth and your income."
        actions={
          <Select value={taxYear} onValueChange={setTaxYear}>
            <SelectTrigger className="w-[11rem]" aria-label="Tax year">
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
        }
      />

      <section aria-label="Wealth totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total assets"
          value={formatPKR(reconciliation?.declaredAssetsPKR ?? 0)}
          icon={Landmark}
          hint="What you own"
          isLoading={loading}
        />
        <StatCard
          label="Total liabilities"
          value={formatPKR(reconciliation?.declaredLiabilitiesPKR ?? 0)}
          icon={Landmark}
          hint="What you owe"
          isLoading={loading}
        />
        <StatCard
          label="Net declared wealth"
          value={formatPKR(reconciliation?.netDeclaredWealthPKR ?? 0)}
          icon={Landmark}
          emphasis
          hint="Assets less liabilities"
          isLoading={loading}
        />
      </section>

      {loading ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : (
        reconciliation && (
          <Card className={isReconciled ? "border-success/20 bg-success-surface" : "border-destructive/20 bg-destructive-surface"}>
            <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <h2 className="flex items-center gap-2 text-base font-semibold tracking-[-0.01em] text-foreground">
                    {isReconciled ? (
                      <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
                    ) : (
                      <XCircle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
                    )}
                    {isReconciled ? "Wealth reconciled" : "Wealth doesn't reconcile"}
                  </h2>
                  <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                    {isReconciled
                      ? "Your declared assets line up with the income and expenses you've reported for this tax year."
                      : `Your declared net wealth is out by ${formatPKR(Math.abs(reconciliation.differencePKR))} against what income minus expenses implies. FBR allows a variance of up to ${formatPKR(reconciliation.toleranceThresholdPKR)}.`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-4 rounded-md border border-border bg-card p-4 sm:gap-6">
                  <div className="text-center">
                    <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Expected</p>
                    <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
                      {formatPKR(reconciliation.expectedClosingWealthPKR)}
                    </p>
                  </div>
                  <span className="text-lg text-subtle" aria-hidden="true">
                    vs
                  </span>
                  <div className="text-center">
                    <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Declared</p>
                    <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
                      {formatPKR(reconciliation.netDeclaredWealthPKR)}
                    </p>
                  </div>
                </div>
              </div>

              <dl className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <dt className="text-muted-foreground">Opening</dt>
                  <dd className="font-mono font-medium tabular-nums text-foreground">
                    {formatPKR(reconciliation.openingWealthPKR)}
                  </dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <dt className="text-success">+ Income</dt>
                  <dd className="font-mono font-medium tabular-nums text-success">
                    {formatPKR(reconciliation.totalIncomePKR)}
                  </dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <dt className="text-muted-foreground">− Expenses</dt>
                  <dd className="font-mono font-medium tabular-nums text-foreground">
                    {formatPKR(reconciliation.totalExpensesPKR)}
                  </dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <dt className="text-muted-foreground">= Expected</dt>
                  <dd className="font-mono font-semibold tabular-nums text-foreground">
                    {formatPKR(reconciliation.expectedClosingWealthPKR)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )
      )}

      <Card>
        <CardToolbar>
          <div className="space-y-1">
            <CardTitle>Opening wealth</CardTitle>
            <CardDescription>Net wealth carried forward from the previous tax year.</CardDescription>
          </div>
        </CardToolbar>
        <CardContent className="pt-5 sm:pt-6">
          <Field
            label="Opening balance"
            htmlFor="opening-wealth"
            hint="Saved when you click away from the field."
            className="max-w-xs"
          >
            <Input
              id="opening-wealth"
              type="number"
              inputMode="numeric"
              className="font-mono tabular-nums"
              value={openingWealth}
              onChange={(e) => setOpeningWealth(e.target.value)}
              onBlur={updateOpeningWealth}
              placeholder="500000"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:gap-6 xl:grid-cols-2">
        {/* Assets */}
        <Card className="overflow-hidden">
          <CardToolbar>
            <div className="space-y-1">
              <CardTitle>Assets</CardTitle>
              <CardDescription>What you own</CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsAssetDialogOpen(true)}>
              <Plus /> Add asset
            </Button>
          </CardToolbar>

          {assetsTable.selected.size > 0 && (
            <BulkActionsBar
              count={assetsTable.selected.size}
              onDelete={() => setBulkAssetConfirmOpen(true)}
              onClear={assetsTable.clearSelection}
              isDeleting={isBulkDeletingAssets}
              label="asset"
            />
          )}

          {loading ? (
            <TableSkeleton rows={4} columns={5} />
          ) : assets.length === 0 ? (
            <EmptyState
              icon={Landmark}
              size="sm"
              title="No assets declared"
              description="Add bank accounts, property or investments so your wealth statement can reconcile."
              action={
                <Button size="sm" onClick={() => setIsAssetDialogOpen(true)}>
                  <Plus /> Add asset
                </Button>
              }
            />
          ) : (
            <>
              <Table className="min-w-[36rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Checkbox
                        checked={assetsTable.allSelectedOnPage}
                        indeterminate={assetsTable.someSelectedOnPage && !assetsTable.allSelectedOnPage}
                        onChange={assetsTable.toggleSelectAll}
                        aria-label="Select all assets on this page"
                      />
                    </TableHead>
                    <SortableTableHead sortKey="name" sort={assetsTable.sort} onSort={assetsTable.toggleSort}>
                      Asset
                    </SortableTableHead>
                    <SortableTableHead sortKey="type" sort={assetsTable.sort} onSort={assetsTable.toggleSort}>
                      Type
                    </SortableTableHead>
                    <SortableTableHead sortKey="balance" sort={assetsTable.sort} onSort={assetsTable.toggleSort} align="right">
                      Balance
                    </SortableTableHead>
                    <SortableTableHead sortKey="currency" sort={assetsTable.sort} onSort={assetsTable.toggleSort}>
                      Currency
                    </SortableTableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assetsTable.paged.map((asset) => (
                    <TableRow key={asset.id} data-state={assetsTable.selected.has(asset.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={assetsTable.selected.has(asset.id)}
                          onChange={() => assetsTable.toggleSelect(asset.id)}
                          aria-label={`Select ${asset.name || asset.description || "asset"}`}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="block font-medium text-foreground">{asset.name || asset.description}</span>
                        {asset.name && asset.description && (
                          <span className="block text-xs text-muted-foreground">{asset.description}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs capitalize text-muted-foreground">
                        {(asset.type || "").toLowerCase()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium tabular-nums text-foreground">
                        {asset.currency === "PKR"
                          ? formatPKR(asset.balance || asset.valuePKR)
                          : new Intl.NumberFormat("en-US").format(Number(asset.balance || 0))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{asset.currency || "PKR"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="hover:bg-destructive-surface hover:text-destructive"
                          onClick={() =>
                            setDeleteAssetTarget({ id: asset.id, name: asset.name || asset.description || "this asset" })
                          }
                          title="Delete asset"
                        >
                          <Trash2 />
                          <span className="sr-only">Delete {asset.name || "asset"}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar
                page={assetsTable.page}
                pageSize={assetsTable.pageSize}
                total={assetsTable.total}
                onPageChange={assetsTable.setPage}
                onPageSizeChange={assetsTable.setPageSize}
              />
            </>
          )}
        </Card>

        {/* Liabilities */}
        <Card className="overflow-hidden">
          <CardToolbar>
            <div className="space-y-1">
              <CardTitle>Liabilities</CardTitle>
              <CardDescription>What you owe</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setIsLiabilityDialogOpen(true)}>
              <Plus /> Add liability
            </Button>
          </CardToolbar>

          {liabilitiesTable.selected.size > 0 && (
            <BulkActionsBar
              count={liabilitiesTable.selected.size}
              onDelete={() => setBulkLiabilityConfirmOpen(true)}
              onClear={liabilitiesTable.clearSelection}
              isDeleting={isBulkDeletingLiabilities}
              label="liability"
            />
          )}

          {loading ? (
            <TableSkeleton rows={4} columns={3} />
          ) : liabilities.length === 0 ? (
            <EmptyState
              icon={Landmark}
              size="sm"
              title="No liabilities declared"
              description="Loans and outstanding balances belong here so net wealth is accurate."
              action={
                <Button size="sm" variant="outline" onClick={() => setIsLiabilityDialogOpen(true)}>
                  <Plus /> Add liability
                </Button>
              }
            />
          ) : (
            <>
              <Table className="min-w-0">
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Checkbox
                        checked={liabilitiesTable.allSelectedOnPage}
                        indeterminate={liabilitiesTable.someSelectedOnPage && !liabilitiesTable.allSelectedOnPage}
                        onChange={liabilitiesTable.toggleSelectAll}
                        aria-label="Select all liabilities on this page"
                      />
                    </TableHead>
                    <SortableTableHead
                      sortKey="description"
                      sort={liabilitiesTable.sort}
                      onSort={liabilitiesTable.toggleSort}
                    >
                      Description
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="amount"
                      sort={liabilitiesTable.sort}
                      onSort={liabilitiesTable.toggleSort}
                      align="right"
                    >
                      Amount
                    </SortableTableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liabilitiesTable.paged.map((liab) => (
                    <TableRow key={liab.id} data-state={liabilitiesTable.selected.has(liab.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={liabilitiesTable.selected.has(liab.id)}
                          onChange={() => liabilitiesTable.toggleSelect(liab.id)}
                          aria-label={`Select ${liab.description || "liability"}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{liab.description}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium tabular-nums text-foreground">
                        {formatPKR(liab.amountPKR)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="hover:bg-destructive-surface hover:text-destructive"
                          onClick={() =>
                            setDeleteLiabilityTarget({
                              id: liab.id,
                              description: liab.description || "this liability",
                            })
                          }
                          title="Delete liability"
                        >
                          <Trash2 />
                          <span className="sr-only">Delete {liab.description || "liability"}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar
                page={liabilitiesTable.page}
                pageSize={liabilitiesTable.pageSize}
                total={liabilitiesTable.total}
                onPageChange={liabilitiesTable.setPage}
                onPageSizeChange={liabilitiesTable.setPageSize}
              />
            </>
          )}
        </Card>
      </div>

      {/* Add asset */}
      <Dialog open={isAssetDialogOpen} onOpenChange={setIsAssetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add asset</DialogTitle>
            <DialogDescription>Declare an asset to include in your wealth statement.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addAsset} className="contents">
            <DialogBody className="space-y-4">
              <Field label="Asset name" htmlFor="asset-name" required>
                <Input
                  id="asset-name"
                  required
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                  placeholder="Meezan Bank current account"
                />
              </Field>

              <Field label="Asset type" htmlFor="asset-type">
                <Select value={newAsset.type} onValueChange={(val) => setNewAsset({ ...newAsset, type: val })}>
                  <SelectTrigger id="asset-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash / bank</SelectItem>
                    <SelectItem value="PROPERTY">Property</SelectItem>
                    <SelectItem value="VEHICLE">Vehicle</SelectItem>
                    <SelectItem value="INVESTMENT">Investment</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Current balance" htmlFor="asset-balance" required>
                  <Input
                    id="asset-balance"
                    required
                    type="number"
                    inputMode="numeric"
                    className="font-mono tabular-nums"
                    value={newAsset.balance}
                    onChange={(e) => setNewAsset({ ...newAsset, balance: e.target.value })}
                    placeholder="0"
                  />
                </Field>

                <Field label="Currency" htmlFor="asset-currency">
                  <Select value={newAsset.currency} onValueChange={(val) => setNewAsset({ ...newAsset, currency: val })}>
                    <SelectTrigger id="asset-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PKR">PKR (Rs)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="USDT">USDT</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field
                label="Value in PKR"
                htmlFor="asset-val"
                required
                hint={newAsset.currency !== "PKR" ? "Enter the PKR equivalent — FBR reconciles in rupees." : undefined}
              >
                <Input
                  id="asset-val"
                  required
                  type="number"
                  inputMode="numeric"
                  className="font-mono tabular-nums"
                  value={newAsset.valuePKR}
                  onChange={(e) => setNewAsset({ ...newAsset, valuePKR: e.target.value })}
                  placeholder="0"
                />
              </Field>

              <Field label="Notes" htmlFor="asset-desc">
                <Input
                  id="asset-desc"
                  value={newAsset.description}
                  onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })}
                  placeholder="Primary checking account"
                />
              </Field>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAssetDialogOpen(false)} disabled={isSavingAsset}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingAsset}>
                {isSavingAsset && <Loader2 className="animate-spin" />} Save asset
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add liability */}
      <Dialog open={isLiabilityDialogOpen} onOpenChange={setIsLiabilityDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add liability</DialogTitle>
            <DialogDescription>Declare a loan or outstanding balance.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addLiability} className="contents">
            <DialogBody className="space-y-4">
              <Field label="Description" htmlFor="liab-desc" required>
                <Input
                  id="liab-desc"
                  required
                  value={newLiability.description}
                  onChange={(e) => setNewLiability({ ...newLiability, description: e.target.value })}
                  placeholder="Car loan"
                />
              </Field>
              <Field label="Amount in PKR" htmlFor="liab-val" required>
                <Input
                  id="liab-val"
                  required
                  type="number"
                  inputMode="numeric"
                  className="font-mono tabular-nums"
                  value={newLiability.amountPKR}
                  onChange={(e) => setNewLiability({ ...newLiability, amountPKR: e.target.value })}
                  placeholder="0"
                />
              </Field>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLiabilityDialogOpen(false)}
                disabled={isSavingLiability}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingLiability}>
                {isSavingLiability && <Loader2 className="animate-spin" />} Save liability
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={!!deleteAssetTarget}
        onClose={() => setDeleteAssetTarget(null)}
        onConfirm={handleConfirmDeleteAsset}
        title="Delete this asset?"
        description={deleteAssetTarget ? `"${deleteAssetTarget.name}" will be removed. This cannot be undone.` : ""}
        confirmText="Delete asset"
      />

      <ConfirmModal
        isOpen={!!deleteLiabilityTarget}
        onClose={() => setDeleteLiabilityTarget(null)}
        onConfirm={handleConfirmDeleteLiability}
        title="Delete this liability?"
        description={
          deleteLiabilityTarget ? `"${deleteLiabilityTarget.description}" will be removed. This cannot be undone.` : ""
        }
        confirmText="Delete liability"
      />

      <ConfirmModal
        isOpen={bulkAssetConfirmOpen}
        onClose={() => setBulkAssetConfirmOpen(false)}
        onConfirm={handleBulkDeleteAssets}
        title={`Delete ${assetsTable.selected.size} asset${assetsTable.selected.size === 1 ? "" : "s"}?`}
        description="This cannot be undone."
        confirmText="Delete selected"
        isLoading={isBulkDeletingAssets}
      />

      <ConfirmModal
        isOpen={bulkLiabilityConfirmOpen}
        onClose={() => setBulkLiabilityConfirmOpen(false)}
        onConfirm={handleBulkDeleteLiabilities}
        title={`Delete ${liabilitiesTable.selected.size} liabilit${liabilitiesTable.selected.size === 1 ? "y" : "ies"}?`}
        description="This cannot be undone."
        confirmText="Delete selected"
        isLoading={isBulkDeletingLiabilities}
      />
    </div>
  )
}

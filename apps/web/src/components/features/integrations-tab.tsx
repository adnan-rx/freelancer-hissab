"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ExternalLink,
  History,
  Info,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardToolbar } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  usePlatforms,
  useConnectedAccounts,
  useGetAuthUrl,
  useConnectPlatform,
  usePreviewSync,
  useSyncPlatform,
  useDisconnectPlatform,
  useConnectionLogs,
  ConnectedAccount,
  ImportPreview,
  PlatformMetadata,
} from "@/hooks/use-integrations";
import { useToast } from "@/providers/toast-provider";
import { CSVImportModal } from "@/components/features/csv-import-modal";
import { apiErrorMessage } from "@/lib/utils";

const pkr = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

function statusVariant(status: ConnectedAccount["status"]) {
  if (status === "connected") return "success" as const;
  if (status === "expired" || status === "error") return "destructive" as const;
  return "neutral" as const;
}

export function IntegrationsTab() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const { data: platforms = [], isLoading: isLoadingPlatforms } = usePlatforms();
  const { data: connectedAccounts = [] } = useConnectedAccounts();

  const getAuthUrl = useGetAuthUrl();
  const connect = useConnectPlatform();
  const previewSync = usePreviewSync();
  const sync = useSyncPlatform();
  const disconnect = useDisconnectPlatform();

  const [logConnectionId, setLogConnectionId] = useState<string | null>(null);
  const { data: syncLogs = [], isLoading: isLoadingLogs } = useConnectionLogs(logConnectionId);

  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [pendingConnectionId, setPendingConnectionId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [redirectingTo, setRedirectingTo] = useState<string | null>(null);

  // React runs effects twice in development; without this the callback code would
  // be exchanged twice and the second attempt fails on a consumed code.
  const handledCallback = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const platform = searchParams.get("platform");
    const oauthError = searchParams.get("error");

    if (oauthError) {
      showError(searchParams.get("error_description") || oauthError, "Authorization declined");
      router.replace("/settings?tab=integrations");
      return;
    }

    if (!code || !state || !platform || handledCallback.current) return;
    handledCallback.current = true;

    void (async () => {
      try {
        const result = await connect.mutateAsync({
          platform,
          code,
          state,
          redirectUri: `${window.location.origin}/settings?tab=integrations&platform=${platform}`,
        });

        if (result?.syncError) {
          showError(
            `${result.connection.accountName} is connected, but the first sync failed: ${result.syncError}`,
            "Connected with warnings",
          );
        } else {
          const summary = result?.syncResult;
          showSuccess(
            `Connected ${result?.connection.accountName}. Imported ${summary?.incomeCreatedCount ?? 0} income and ${summary?.expensesCreatedCount ?? 0} fee records.`,
            "Account connected",
          );
        }
      } catch (err: unknown) {
        showError(apiErrorMessage(err, "Could not complete the authorization."), "Connection failed");
      } finally {
        router.replace("/settings?tab=integrations");
      }
    })();
  }, [searchParams, connect, router, showError, showSuccess]);

  const startAuthorization = async (platformId: string) => {
    setRedirectingTo(platformId);
    try {
      const redirectUri = `${window.location.origin}/settings?tab=integrations&platform=${platformId}`;
      const result = await getAuthUrl.mutateAsync({ platform: platformId, redirectUri });
      if (result?.authUrl) window.location.href = result.authUrl;
    } catch (err: unknown) {
      showError(apiErrorMessage(err, "Could not start the authorization."), "Connection failed");
      setRedirectingTo(null);
    }
  };

  /** Sync is preview-first: nothing is written until the user confirms. */
  const openSyncPreview = async (account: ConnectedAccount) => {
    setPendingConnectionId(account.id);
    setPreview(null);
    try {
      const result = await previewSync.mutateAsync(account.id);
      setPreview(result ?? null);
    } catch (err: unknown) {
      setPendingConnectionId(null);
      showError(apiErrorMessage(err, `Could not read from ${account.accountName}.`), "Sync failed");
    }
  };

  const confirmSync = async () => {
    if (!pendingConnectionId) return;
    const connectionId = pendingConnectionId;
    setPendingConnectionId(null);
    setPreview(null);

    try {
      const result = await sync.mutateAsync(connectionId);
      const created = (result?.incomeCreatedCount ?? 0) + (result?.expensesCreatedCount ?? 0);
      showSuccess(
        created > 0
          ? `Imported ${result?.incomeCreatedCount} income and ${result?.expensesCreatedCount} fee records.`
          : `Already up to date — ${result?.duplicatesSkippedCount ?? 0} transactions were already in your ledger.`,
        "Sync complete",
      );
    } catch (err: unknown) {
      showError(apiErrorMessage(err, "Synchronization failed."), "Sync failed");
    }
  };

  const handleDisconnect = async (account: ConnectedAccount) => {
    try {
      const result = await disconnect.mutateAsync(account.id);
      showSuccess(result?.message ?? `Disconnected ${account.accountName}.`, "Disconnected");
    } catch (err: unknown) {
      showError(apiErrorMessage(err, "Could not disconnect the account."), "Disconnect failed");
    }
  };

  const accountFor = (platformId: string) =>
    connectedAccounts.find((account) => account.platform === platformId);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/40 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Connected platforms</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Where a platform publishes an official API for your earnings, we sync transactions, fees, clients
              and invoices automatically. Credentials are encrypted at rest and never leave the server. Where no
              such API exists we say so and import your statement instead — we never scrape.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {isLoadingPlatforms
          ? Array.from({ length: 3 }, (_, i) => (
              <Card key={i} className="h-56 animate-pulse border-border bg-muted/30" />
            ))
          : platforms.map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                account={accountFor(platform.id)}
                isConnecting={redirectingTo === platform.id}
                isSyncing={previewSync.isPending && pendingConnectionId === accountFor(platform.id)?.id}
                onConnect={() => startAuthorization(platform.id)}
                onSync={openSyncPreview}
                onDisconnect={handleDisconnect}
                onViewLogs={setLogConnectionId}
                onImportStatement={() => setIsCsvModalOpen(true)}
              />
            ))}
      </div>

      <Card>
        <CardToolbar>
          <div className="space-y-1">
            <CardTitle>Connected accounts</CardTitle>
            <CardDescription>Sync status and diagnostics for every account you have connected.</CardDescription>
          </div>
        </CardToolbar>

        <CardContent className="pt-4">
          {connectedAccounts.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No accounts connected yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Platform</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last successful sync</TableHead>
                    <TableHead className="text-right">Imported</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connectedAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-semibold uppercase text-foreground">{account.platform}</TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{account.accountName}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {account.accountIdentifier}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(account.status)} className="text-[10px]">
                          {account.status}
                        </Badge>
                        {account.lastSyncError && (
                          <div
                            className="mt-0.5 max-w-[180px] truncate text-[10px] text-destructive"
                            title={account.lastSyncError}
                          >
                            {account.lastSyncError}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {account.lastSuccessfulSyncAt
                          ? format(new Date(account.lastSuccessfulSyncAt), "MMM d, yyyy HH:mm")
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-foreground">
                        {account.syncedTransactionsCount}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {account.failedTransactionsCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => void openSyncPreview(account)}
                            disabled={previewSync.isPending || sync.isPending}
                          >
                            <RefreshCw className="mr-1 size-3" /> Sync
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => setLogConnectionId(account.id)}
                          >
                            <History className="mr-1 size-3" /> History
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive hover:bg-destructive-surface"
                            onClick={() => void handleDisconnect(account)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import preview — nothing is written until this is confirmed. */}
      <Dialog
        open={pendingConnectionId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingConnectionId(null);
            setPreview(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review before importing</DialogTitle>
            <DialogDescription>
              Nothing has been written yet. Confirm to add these records to your ledger.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {previewSync.isPending || !preview ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryTile label="Transactions" value={String(preview.transactionCount)} />
                  <SummaryTile label="Gross earnings" value={pkr.format(preview.grossAmountPKR)} />
                  <SummaryTile label="Platform fees" value={`-${pkr.format(preview.feesAmountPKR)}`} tone="negative" />
                  <SummaryTile label="Net" value={pkr.format(preview.netAmountPKR)} tone="positive" />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryTile label="Income records" value={String(preview.incomeCount)} />
                  <SummaryTile label="Fee records" value={String(preview.expenseCount)} />
                  <SummaryTile label="New invoices" value={String(preview.newInvoiceCount)} />
                  <SummaryTile label="Already imported" value={String(preview.duplicateCount)} />
                </div>

                {preview.currencyTotals.length > 0 && (
                  <div className="rounded-md border border-border p-3 text-xs">
                    <div className="mb-1.5 font-medium text-foreground">Source currency</div>
                    <div className="space-y-0.5 text-muted-foreground">
                      {preview.currencyTotals.map((total) => (
                        <div key={total.currency} className="flex justify-between font-mono">
                          <span>{total.currency}</span>
                          <span>
                            {total.gross.toFixed(2)} gross · {total.fees.toFixed(2)} fees · {total.net.toFixed(2)} net
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-md border border-border p-3 text-xs">
                  <div className="mb-1.5 font-medium text-foreground">Clients</div>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.newClients.map((client) => (
                      <Badge key={client} variant="info" className="text-[10px]">
                        New · {client}
                      </Badge>
                    ))}
                    {preview.existingClients.map((client) => (
                      <Badge key={client} variant="neutral" className="text-[10px]">
                        Existing · {client}
                      </Badge>
                    ))}
                    {preview.newClients.length === 0 && preview.existingClients.length === 0 && (
                      <span className="text-muted-foreground">No client attribution in this batch.</span>
                    )}
                  </div>
                </div>

                {preview.warnings.length > 0 && (
                  <div className="space-y-1 rounded-md border border-amber-500/20 bg-amber-50/60 p-3 text-[11px] text-amber-900">
                    {preview.warnings.map((warning) => (
                      <div key={warning} className="flex items-start gap-1.5">
                        <AlertTriangle className="mt-px size-3.5 shrink-0 text-amber-600" />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}

                {preview.items.length > 0 && (
                  <div className="overflow-hidden rounded-md border border-border">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Counterparty</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.items.map((item) => (
                          <TableRow key={`${item.externalId}-${item.type}`} className={item.isDuplicate ? "opacity-50" : ""}>
                            <TableCell className="whitespace-nowrap font-mono text-muted-foreground">
                              {item.date}
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate" title={item.description}>
                              {item.description}
                              {item.isDuplicate && (
                                <Badge variant="neutral" className="ml-1.5 text-[9px]">
                                  already imported
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{item.counterparty}</TableCell>
                            <TableCell
                              className={`text-right font-mono ${item.type === "income" ? "text-success" : "text-destructive"}`}
                            >
                              {item.type === "income" ? "+" : "-"}
                              {item.amount.toFixed(2)} {item.currency}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setPendingConnectionId(null);
                setPreview(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void confirmSync()}
              disabled={!preview || sync.isPending || preview.incomeCount + preview.expenseCount === 0}
            >
              {sync.isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Importing…
                </>
              ) : (
                `Import ${preview ? preview.incomeCount + preview.expenseCount : 0} record(s)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync history */}
      <Dialog open={!!logConnectionId} onOpenChange={(open) => !open && setLogConnectionId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sync history</DialogTitle>
            <DialogDescription>Every manual, initial and background run for this account.</DialogDescription>
          </DialogHeader>

          <DialogBody className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {isLoadingLogs ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : syncLogs.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">No sync history yet.</div>
            ) : (
              <div className="overflow-hidden rounded-md border border-border">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Income</TableHead>
                      <TableHead className="text-right">Fees</TableHead>
                      <TableHead className="text-right">Skipped</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap font-mono text-muted-foreground">
                          {format(new Date(log.startedAt), "MMM d, HH:mm:ss")}
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">{log.syncType}</TableCell>
                        <TableCell>
                          <Badge
                            variant={log.status === "success" ? "success" : "destructive"}
                            className="text-[10px]"
                          >
                            {log.status}
                          </Badge>
                          {log.errorMessage && (
                            <div
                              className="mt-0.5 max-w-[180px] truncate text-[10px] text-destructive"
                              title={log.errorMessage}
                            >
                              {log.errorMessage}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-success">
                          +{log.incomeCreatedCount}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-destructive">
                          +{log.expensesCreatedCount}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {log.duplicatesSkippedCount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLogConnectionId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CSVImportModal isOpen={isCsvModalOpen} onClose={() => setIsCsvModalOpen(false)} />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive" ? "text-success" : tone === "negative" ? "text-destructive" : "text-foreground";

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

/**
 * One card per platform, rendered from the server's capability metadata rather
 * than hardcoded copy — so a platform can never be shown as automatically
 * syncable unless its connector actually reports that.
 */
function PlatformCard({
  platform,
  account,
  isConnecting,
  isSyncing,
  onConnect,
  onSync,
  onDisconnect,
  onViewLogs,
  onImportStatement,
}: {
  platform: PlatformMetadata;
  account?: ConnectedAccount;
  isConnecting: boolean;
  isSyncing: boolean;
  onConnect: () => void;
  onSync: (account: ConnectedAccount) => void;
  onDisconnect: (account: ConnectedAccount) => void;
  onViewLogs: (connectionId: string) => void;
  onImportStatement: () => void;
}) {
  const canAutoSync = platform.capabilities.automaticSync;
  const needsReconnect = account?.status === "expired";

  return (
    <Card className="flex flex-col justify-between border-border">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{platform.name}</CardTitle>
            <Badge variant={canAutoSync ? "success" : "neutral"} className="text-[11px]">
              {canAutoSync ? "Automatic sync" : "Statement import"}
            </Badge>
          </div>
          <CardDescription className="mt-2 text-xs leading-relaxed">{platform.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 pt-0 text-xs">
          {!canAutoSync && platform.limitationNotice && (
            <div className="space-y-1 rounded-md border border-amber-500/20 bg-amber-50/60 p-3 text-amber-900">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                <Info className="size-3.5 shrink-0 text-amber-600" />
                <span>Why this platform is not synced automatically</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">{platform.limitationNotice}</p>
            </div>
          )}

          {canAutoSync &&
            (account ? (
              <div className="space-y-2 rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-foreground">{account.accountName}</span>
                  <Badge variant={statusVariant(account.status)} className="text-[10px]">
                    {account.status}
                  </Badge>
                </div>
                <div className="space-y-0.5 text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Last sync</span>
                    <span className="font-mono text-foreground">
                      {account.lastSuccessfulSyncAt
                        ? format(new Date(account.lastSuccessfulSyncAt), "MMM d, HH:mm")
                        : "Never"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Imported records</span>
                    <span className="font-mono font-medium text-foreground">
                      {account.syncedTransactionsCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Failed runs</span>
                    <span className="font-mono text-foreground">{account.failedTransactionsCount}</span>
                  </div>
                </div>
                {account.lastSyncError && (
                  <div className="rounded border border-destructive/20 bg-destructive-surface p-2 text-[11px] text-destructive">
                    {account.lastSyncError}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border p-3 text-center text-muted-foreground">
                Not connected yet.
              </div>
            ))}
        </CardContent>
      </div>

      <div className="border-t border-border bg-muted/20 p-4">
        {!canAutoSync ? (
          <Button variant="outline" className="w-full text-xs" onClick={onImportStatement}>
            <UploadCloud className="mr-1.5 size-3.5" /> Import statement
          </Button>
        ) : account && !needsReconnect ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" className="text-xs" onClick={() => onSync(account)} disabled={isSyncing}>
              {isSyncing ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Checking…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-1.5 size-3.5" /> Sync now
                </>
              )}
            </Button>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => onViewLogs(account.id)}>
                <History className="mr-1 size-3.5" /> History
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive-surface"
                onClick={() => onDisconnect(account)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <Button className="w-full text-xs" onClick={onConnect} disabled={isConnecting}>
            {isConnecting ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Redirecting…
              </>
            ) : needsReconnect ? (
              <>
                <ExternalLink className="mr-1.5 size-3.5" /> Reconnect {platform.name}
              </>
            ) : (
              <>
                <Link2 className="mr-1.5 size-3.5" /> Connect {platform.name}
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { unwrapApi } from "@/lib/utils";

export type PlatformId = "upwork" | "fiverr" | "freelancer" | "toptal" | "generic";
export type AuthMechanism = "oauth2" | "csv_only";
export type ConnectionStatus = "connected" | "expired" | "error" | "disconnected";
export type SyncStatus = "idle" | "syncing" | "success" | "failed";

export interface PlatformCapabilities {
  automaticSync: boolean;
  incrementalSync: boolean;
  feeExtraction: boolean;
  clientAttribution: boolean;
  webhooks: boolean;
  csvFallback: boolean;
}

export interface PlatformMetadata {
  id: PlatformId;
  name: string;
  authMechanism: AuthMechanism;
  description: string;
  documentationUrl: string;
  capabilities: PlatformCapabilities;
  limitationNotice?: string;
}

export interface ConnectedAccount {
  id: string;
  platform: PlatformId;
  accountIdentifier: string;
  accountName: string;
  status: ConnectionStatus;
  syncStatus: SyncStatus;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncError: string | null;
  syncedTransactionsCount: number;
  failedTransactionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncLogItem {
  id: string;
  connectionId: string;
  platform: string;
  syncType: "manual" | "scheduled" | "initial";
  status: "success" | "failed" | "partial";
  sinceTimestamp: string | null;
  fetchedCount: number;
  incomeCreatedCount: number;
  expensesCreatedCount: number;
  clientsCreatedCount: number;
  invoicesCreatedCount: number;
  duplicatesSkippedCount: number;
  failedCount: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface SyncSummary {
  success: boolean;
  fetchedCount: number;
  incomeCreatedCount: number;
  expensesCreatedCount: number;
  clientsCreatedCount: number;
  invoicesCreatedCount: number;
  duplicatesSkippedCount: number;
  failedCount: number;
  syncedAt: string;
}

export interface PreviewLineItem {
  externalId: string;
  date: string;
  type: "income" | "expense";
  description: string;
  counterparty: string;
  currency: string;
  amount: number;
  amountPKR: number;
  isDuplicate: boolean;
}

export interface ImportPreview {
  platform: PlatformId;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  duplicateCount: number;
  grossAmountPKR: number;
  feesAmountPKR: number;
  netAmountPKR: number;
  currencyTotals: Array<{ currency: string; gross: number; fees: number; net: number }>;
  newClients: string[];
  existingClients: string[];
  newInvoiceCount: number;
  items: PreviewLineItem[];
  warnings: string[];
}

/** Anything an import can touch, so the whole app reflects new records at once. */
const LEDGER_QUERY_KEYS = [
  "connected-accounts",
  "platform-sync-logs",
  "income",
  "expenses",
  "invoices",
  "clients",
  "transactions",
  "tax-estimate",
  "filing-readiness",
  "dashboard-summary",
  "wealth-reconciliation",
  "reports",
];

function useLedgerInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of LEDGER_QUERY_KEYS) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function usePlatforms() {
  return useQuery<PlatformMetadata[]>({
    queryKey: ["integration-platforms"],
    queryFn: async () => {
      const res = await apiClient.get("/integrations/platforms");
      return unwrapApi<PlatformMetadata[]>(res) || [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useConnectedAccounts() {
  return useQuery<ConnectedAccount[]>({
    queryKey: ["connected-accounts"],
    queryFn: async () => {
      const res = await apiClient.get("/integrations/connections");
      return unwrapApi<ConnectedAccount[]>(res) || [];
    },
  });
}

export function useGetAuthUrl() {
  return useMutation({
    mutationFn: async ({ platform, redirectUri }: { platform: string; redirectUri?: string }) => {
      const res = await apiClient.get(`/integrations/connect/${platform}/auth-url`, {
        params: { redirectUri },
      });
      return unwrapApi<{ authUrl: string; state: string }>(res);
    },
  });
}

/** Completes an authorization. Also the reconnect path — the API updates in place. */
export function useConnectPlatform() {
  const invalidateLedger = useLedgerInvalidation();

  return useMutation({
    mutationFn: async (input: { platform: string; code: string; state: string; redirectUri?: string }) => {
      const res = await apiClient.post(`/integrations/connect/${input.platform}/callback`, {
        code: input.code,
        state: input.state,
        redirectUri: input.redirectUri,
      });
      return unwrapApi<{
        connection: ConnectedAccount;
        syncResult: SyncSummary | null;
        syncError: string | null;
      }>(res);
    },
    onSuccess: invalidateLedger,
  });
}

/** Dry run — what a sync would import. Writes nothing. */
export function usePreviewSync() {
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiClient.post(`/integrations/${connectionId}/sync/preview`, {});
      return unwrapApi<ImportPreview>(res);
    },
  });
}

export function useSyncPlatform() {
  const invalidateLedger = useLedgerInvalidation();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiClient.post(`/integrations/${connectionId}/sync`, {});
      return unwrapApi<SyncSummary>(res);
    },
    onSuccess: invalidateLedger,
  });
}

export function useDisconnectPlatform() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiClient.delete(`/integrations/${connectionId}`);
      return unwrapApi<{ success: boolean; message: string }>(res);
    },
    // Imported records stay, so only the connection list changes.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["connected-accounts"] }),
  });
}

export function useConnectionLogs(connectionId: string | null) {
  return useQuery<SyncLogItem[]>({
    queryKey: ["platform-sync-logs", connectionId],
    queryFn: async () => {
      if (!connectionId) return [];
      const res = await apiClient.get(`/integrations/${connectionId}/logs`);
      return unwrapApi<SyncLogItem[]>(res) || [];
    },
    enabled: !!connectionId,
  });
}

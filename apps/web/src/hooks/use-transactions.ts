import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { unwrapApi } from "@/lib/utils";

export type TransactionType = "INCOME" | "EXPENSE";

export interface UnifiedTransaction {
  id: string;
  type: TransactionType;
  date: string;
  amount: number;
  currency: string;
  description: string;
  category: string;
  entity: string;
  createdAt: string;
}

export type TransactionSortKey = "date" | "entity" | "category" | "amount";

export interface TransactionsFilter {
  search?: string;
  type?: TransactionType | "ALL";
  /** 'YYYY-MM-DD', inclusive on both ends. */
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: TransactionSortKey;
  sortDir?: "asc" | "desc";
}

export interface PaginatedTransactions {
  data: UnifiedTransaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useTransactions(filter: TransactionsFilter = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { search, type, startDate, endDate, page = 1, pageSize = 20, sortBy, sortDir } = filter;

  return useQuery({
    queryKey: ["transactions", accessToken, search, type, startDate, endDate, page, pageSize, sortBy, sortDir],
    queryFn: async (): Promise<PaginatedTransactions> => {
      const res = await apiClient.get("/transactions", {
        params: {
          search: search || undefined,
          type: type && type !== "ALL" ? type : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page,
          pageSize,
          sortBy,
          sortDir,
        },
      });
      const payload = unwrapApi<Partial<PaginatedTransactions>>(res);
      return {
        data: Array.isArray(payload?.data) ? payload.data : [],
        total: payload?.total ?? 0,
        page: payload?.page ?? 1,
        pageSize: payload?.pageSize ?? pageSize,
        totalPages: payload?.totalPages ?? 1,
      };
    },
    enabled: !!accessToken,
    // Keeps the current page's rows on screen while the next page loads,
    // instead of flashing the loading state on every click.
    placeholderData: keepPreviousData,
  });
}

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

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

export interface TransactionsFilter {
  search?: string;
  type?: TransactionType | "ALL";
  /** 'YYYY-MM-DD', inclusive on both ends. */
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedTransactions {
  data: UnifiedTransaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const EMPTY_RESULT: PaginatedTransactions = { data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };

export function useTransactions(filter: TransactionsFilter = {}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { search, type, startDate, endDate, page = 1, pageSize = 20 } = filter;

  return useQuery({
    queryKey: ["transactions", accessToken, search, type, startDate, endDate, page, pageSize],
    queryFn: async (): Promise<PaginatedTransactions> => {
      if (!accessToken) return EMPTY_RESULT;

      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (type && type !== "ALL") params.append("type", type);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("page", String(page));
      params.append("pageSize", String(pageSize));

      try {
        const res = await apiClient.get(`/transactions?${params.toString()}`);
        // The global interceptor wraps every response as { success, data, error };
        // the controller also returns { success, data, total, page, pageSize, totalPages },
        // so the payload we want lives at res.data.data.
        const payload = res.data?.data ?? res.data;
        return {
          data: Array.isArray(payload?.data) ? payload.data : [],
          total: payload?.total ?? 0,
          page: payload?.page ?? 1,
          pageSize: payload?.pageSize ?? pageSize,
          totalPages: payload?.totalPages ?? 1,
        };
      } catch (e) {
        console.warn("Failed to fetch transactions:", e);
        return EMPTY_RESULT;
      }
    },
    enabled: !!accessToken,
    // Keeps the current page's rows on screen while the next page loads,
    // instead of flashing the loading state on every click.
    placeholderData: keepPreviousData,
  });
}

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

export type TransactionType = 'INCOME' | 'EXPENSE';

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

export function useTransactions(search?: string, type?: TransactionType | 'ALL') {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["transactions", accessToken, search, type],
    queryFn: async () => {
      if (!accessToken) return [];
      
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (type && type !== 'ALL') params.append('type', type);

      const queryStr = params.toString();
      const endpoint = `/transactions${queryStr ? `?${queryStr}` : ''}`;
      
      try {
        const res = await apiClient.get(endpoint);
        const data = res.data;
        // Unwrap nested API payload
        return (data?.data?.data || data?.data || data || []) as UnifiedTransaction[];
      } catch (e) {
        console.warn("Failed to fetch transactions:", e);
        return [];
      }
    },
    enabled: !!accessToken,
  });
}

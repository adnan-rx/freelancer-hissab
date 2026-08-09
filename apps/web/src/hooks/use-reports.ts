import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

export function useIncomeVsExpensesReport() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["report-income-vs-expenses", accessToken],
    queryFn: async () => {
      if (!accessToken) return [];
      try {
        const res = await apiClient.get("/reports/income-vs-expenses");
        const resData = res.data;
        const list = resData?.data?.data || resData?.data || resData || [];
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!accessToken,
  });
}

export function useClientBreakdownReport() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["report-client-breakdown", accessToken],
    queryFn: async () => {
      if (!accessToken) return [];
      try {
        const res = await apiClient.get("/reports/client-breakdown");
        const resData = res.data;
        const list = resData?.data?.data || resData?.data || resData || [];
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!accessToken,
  });
}

export function usePlatformBreakdownReport() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["report-platform-breakdown", accessToken],
    queryFn: async () => {
      if (!accessToken) return [];
      try {
        const res = await apiClient.get("/reports/platform-breakdown");
        const resData = res.data;
        const list = resData?.data?.data || resData?.data || resData || [];
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!accessToken,
  });
}

export function useIncomeConsolidation(year?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["report-income-consolidation", year, accessToken],
    queryFn: async () => {
      if (!accessToken) return null;
      try {
        const url = year ? `/reports/income-consolidation?year=${year}` : "/reports/income-consolidation";
        const res = await apiClient.get(url);
        const resData = res.data;
        return resData?.data?.data || resData?.data || resData || null;
      } catch (e) {
        return null;
      }
    },
    enabled: !!accessToken,
  });
}

export function useTaxEstimate(isPseb = true) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["tax-estimate", isPseb, accessToken],
    queryFn: async () => {
      if (!accessToken) return null;
      try {
        const res = await apiClient.get(`/tax/estimate?pseb=${isPseb}`);
        const resData = res.data;
        return resData?.data?.data || resData?.data || resData;
      } catch (e) {
        return null;
      }
    },
    enabled: !!accessToken,
  });
}

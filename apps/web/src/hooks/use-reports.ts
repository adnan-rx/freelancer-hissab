import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useIncomeVsExpensesReport() {
  return useQuery({
    queryKey: ["report-income-vs-expenses"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get("/reports/income-vs-expenses");
        return data.data || [];
      } catch (e) {
        return [];
      }
    },
  });
}

export function useClientBreakdownReport() {
  return useQuery({
    queryKey: ["report-client-breakdown"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get("/reports/client-breakdown");
        return data.data || [];
      } catch (e) {
        return [];
      }
    },
  });
}

export function usePlatformBreakdownReport() {
  return useQuery({
    queryKey: ["report-platform-breakdown"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get("/reports/platform-breakdown");
        return data.data || [];
      } catch (e) {
        return [];
      }
    },
  });
}

export function useTaxEstimate(isPseb = true) {
  return useQuery({
    queryKey: ["tax-estimate", isPseb],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get(`/tax/estimate?pseb=${isPseb}`);
        return data.data || data;
      } catch (e) {
        return null;
      }
    },
  });
}

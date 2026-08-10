import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { getCurrentTaxYear } from "@/lib/tax-year";
import { unwrapApi } from "@/lib/utils";

export function useIncomeVsExpensesReport(year: string = String(getCurrentTaxYear())) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["report-income-vs-expenses", year, accessToken],
    queryFn: async () => {
      const res = await apiClient.get("/reports/income-vs-expenses", { params: { year } });
      const list = unwrapApi<any[]>(res);
      return Array.isArray(list) ? list : [];
    },
    enabled: !!accessToken,
  });
}

export function useIncomeConsolidation(year: string = String(getCurrentTaxYear())) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["report-income-consolidation", year, accessToken],
    queryFn: async () => {
      const res = await apiClient.get("/reports/income-consolidation", { params: { year } });
      return unwrapApi(res);
    },
    enabled: !!accessToken,
  });
}

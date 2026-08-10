import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { unwrapApi } from "@/lib/utils";

export function useDashboardSummary(year?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["dashboard-summary", year, accessToken],
    queryFn: async () => {
      const res = await apiClient.get("/dashboard/summary", { params: year ? { year } : undefined });
      return unwrapApi(res);
    },
    enabled: !!accessToken,
  });
}

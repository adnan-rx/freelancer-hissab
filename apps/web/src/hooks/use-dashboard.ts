import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

export function useDashboardSummary() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["dashboard-summary", accessToken],
    queryFn: async () => {
      if (!accessToken) return null;
      try {
        const res = await apiClient.get("/dashboard/summary");
        const resData = res.data;
        return resData?.data?.data || resData?.data || resData;
      } catch (e) {
        return null;
      }
    },
    enabled: !!accessToken,
  });
}

export function useRecentActivity() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["dashboard-activity", accessToken],
    queryFn: async () => {
      if (!accessToken) return [];
      try {
        const res = await apiClient.get("/dashboard/recent-activity");
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

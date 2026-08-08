import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get("/dashboard/summary");
        return data.data;
      } catch (e) {
        return null;
      }
    },
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get("/dashboard/recent-activity");
        return data.data;
      } catch (e) {
        return [];
      }
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

export function useReadinessScore(year?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["filing-readiness", year, accessToken],
    queryFn: async () => {
      if (!accessToken) return null;
      try {
        const url = year ? `/filing/readiness?year=${year}` : "/filing/readiness";
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

export function useFilingChecklist(year?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["filing-checklist", year, accessToken],
    queryFn: async () => {
      if (!accessToken) return null;
      try {
        const url = year ? `/filing/checklist?year=${year}` : "/filing/checklist";
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

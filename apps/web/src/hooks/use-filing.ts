import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { unwrapApi } from "@/lib/utils";

export function useReadinessScore(year?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["filing-readiness", year, accessToken],
    queryFn: async () => {
      const res = await apiClient.get("/filing/readiness", { params: year ? { year } : undefined });
      return unwrapApi(res);
    },
    enabled: !!accessToken,
  });
}

export function useFilingChecklist(year?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["filing-checklist", year, accessToken],
    queryFn: async () => {
      const res = await apiClient.get("/filing/checklist", { params: year ? { year } : undefined });
      return unwrapApi(res);
    },
    enabled: !!accessToken,
  });
}

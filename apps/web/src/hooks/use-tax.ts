import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

export function useTaxEstimate(year?: number, pseb?: boolean) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["tax-estimate", year, pseb, accessToken],
    queryFn: async () => {
      if (!accessToken) return null;
      try {
        let url = "/tax/estimate";
        const params = new URLSearchParams();
        if (year) params.append("year", year.toString());
        if (pseb !== undefined) params.append("pseb", pseb.toString());
        
        if (params.toString()) url += `?${params.toString()}`;
        
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

export function useSimulateTax() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (data: { incomePKR: number; localIncomePKR?: number; expensesPKR?: number; year?: number; pseb?: boolean }) => {
      const res = await apiClient.post("/tax/simulate", data);
      return res.data?.data || res.data;
    },
  });
}

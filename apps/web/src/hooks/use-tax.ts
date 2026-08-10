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

export function useTaxRules(yearLabel?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["tax-rules", yearLabel, accessToken],
    queryFn: async () => {
      if (!accessToken) return [];
      try {
        let url = "/tax/rules";
        if (yearLabel) url += `?year=${encodeURIComponent(yearLabel)}`;
        const res = await apiClient.get(url);
        const resData = res.data;
        return resData?.data || resData || [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!accessToken,
  });
}

export function useCreateTaxRule() {
  const { refetch } = useTaxRules();
  
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post("/tax/rules", data);
      return res.data;
    },
  });
}

export function useUpdateTaxRule() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiClient.patch(`/tax/rules/${id}`, data);
      return res.data;
    },
  });
}

export function useDeleteTaxRule() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/tax/rules/${id}`);
      return res.data;
    },
  });
}

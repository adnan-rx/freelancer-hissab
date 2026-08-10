import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { unwrapApi } from "@/lib/utils";

export function useTaxEstimate(year?: number, pseb?: boolean) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["tax-estimate", year, pseb, accessToken],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (year) params.year = year.toString();
      // Omitted entirely (not just "true") when the caller has no opinion, so
      // the backend derives PSEB status from the user's own profile.
      if (pseb !== undefined) params.pseb = pseb.toString();

      const res = await apiClient.get("/tax/estimate", { params });
      return unwrapApi(res);
    },
    enabled: !!accessToken,
  });
}

export function useSimulateTax() {
  return useMutation({
    mutationFn: async (data: { incomePKR: number; localIncomePKR?: number; expensesPKR?: number; year?: number; pseb?: boolean }) => {
      const res = await apiClient.post("/tax/simulate", data);
      return unwrapApi(res);
    },
    // tax-simulator/page.tsx passes its own onError to `.mutate()`.
    meta: { suppressErrorToast: true },
  });
}

export function useTaxRules(yearLabel?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["tax-rules", yearLabel, accessToken],
    queryFn: async () => {
      const res = await apiClient.get("/tax/rules", { params: yearLabel ? { year: yearLabel } : undefined });
      const list = unwrapApi<any[]>(res);
      return Array.isArray(list) ? list : [];
    },
    enabled: !!accessToken,
  });
}

export function useCreateTaxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post("/tax/rules", data);
      return unwrapApi(res);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tax-rules"] }),
  });
}

export function useUpdateTaxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiClient.patch(`/tax/rules/${id}`, data);
      return unwrapApi(res);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tax-rules"] }),
  });
}

export function useDeleteTaxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/tax/rules/${id}`);
      return unwrapApi(res);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tax-rules"] }),
  });
}

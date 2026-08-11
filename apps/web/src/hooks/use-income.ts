import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { unwrapApi } from "@/lib/utils";

export function useIncome() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["income", accessToken],
    queryFn: async () => {
      const res = await apiClient.get("/income");
      const list = unwrapApi<any[]>(res);
      return Array.isArray(list) ? list : [];
    },
    enabled: !!accessToken,
  });
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["income"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  queryClient.invalidateQueries({ queryKey: ["filing-readiness"] });
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
  // Income created against an invoice can flip that invoice to paid.
  queryClient.invalidateQueries({ queryKey: ["invoices"] });
  queryClient.invalidateQueries({ queryKey: ["invoice"] });
}

export function useCreateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/income", payload);
      return unwrapApi(res);
    },
    // add-income-modal.tsx shows its own inline validation/error banner.
    meta: { suppressErrorToast: true },
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; [key: string]: any }) => {
      const res = await apiClient.patch(`/income/${id}`, payload);
      return unwrapApi(res);
    },
    meta: { suppressErrorToast: true },
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/income/${id}`);
      return unwrapApi(res);
    },
    // Single vs. bulk delete show their own success/failure counts.
    meta: { suppressErrorToast: true },
    onSuccess: () => invalidateAll(queryClient),
  });
}

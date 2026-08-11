import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { unwrapApi } from "@/lib/utils";

export function useClients(search?: string, platform?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["clients", search, platform, accessToken],
    queryFn: async () => {
      // `platform` was previously never sent — the API supports filtering by
      // it, but the page re-implemented the same filter client-side over the
      // unfiltered result instead.
      const res = await apiClient.get("/clients", { params: { search, platform } });
      const list = unwrapApi<any[]>(res);
      return Array.isArray(list) ? list : [];
    },
    enabled: !!accessToken,
  });
}

export function useClient(id: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["client", id, accessToken],
    queryFn: async () => {
      const res = await apiClient.get(`/clients/${id}`);
      return unwrapApi(res);
    },
    enabled: !!accessToken && !!id,
    retry: false,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/clients", payload);
      return unwrapApi(res);
    },
    // The clients page already reports both success and failure locally.
    meta: { suppressErrorToast: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; [key: string]: any }) => {
      const res = await apiClient.patch(`/clients/${id}`, payload);
      return unwrapApi(res);
    },
    meta: { suppressErrorToast: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, force }: { id: string; force?: boolean }) => {
      const res = await apiClient.delete(`/clients/${id}`, { params: force ? { force: "true" } : undefined });
      return unwrapApi(res);
    },
    // The 409 "this will also delete N invoices" response drives a second
    // confirm step rather than a plain failure, so the caller must decide
    // what a rejection means — a generic toast here would be misleading.
    meta: { suppressErrorToast: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

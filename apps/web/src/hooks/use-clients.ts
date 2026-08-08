import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

export function useClients(search?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["clients", search, accessToken],
    queryFn: async () => {
      if (!accessToken) return [];
      try {
        const res = await apiClient.get("/clients", { params: { search } });
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

export function useClient(id: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["client", id, accessToken],
    queryFn: async () => {
      if (!accessToken || !id) return null;
      try {
        const res = await apiClient.get(`/clients/${id}`);
        const resData = res.data;
        return resData?.data?.data || resData?.data || resData;
      } catch (e) {
        return null;
      }
    },
    enabled: !!accessToken && !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/clients", payload);
      const resData = res.data;
      return resData?.data?.data || resData?.data || resData;
    },
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
      const resData = res.data;
      return resData?.data?.data || resData?.data || resData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/clients/${id}`);
      const resData = res.data;
      return resData?.data?.data || resData?.data || resData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

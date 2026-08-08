import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useClients(search?: string) {
  return useQuery({
    queryKey: ["clients", search],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get("/clients", { params: { search } });
        return data.data || [];
      } catch (e) {
        return [];
      }
    },
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get(`/clients/${id}`);
        return data.data;
      } catch (e) {
        return null;
      }
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post("/clients", payload);
      return data.data;
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
      const { data } = await apiClient.patch(`/clients/${id}`, payload);
      return data.data;
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
      const { data } = await apiClient.delete(`/clients/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

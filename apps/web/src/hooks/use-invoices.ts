import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useInvoices(status?: string) {
  return useQuery({
    queryKey: ["invoices", status],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get("/invoices", { params: { status } });
        return data.data || [];
      } catch (e) {
        return [];
      }
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get(`/invoices/${id}`);
        return data.data;
      } catch (e) {
        return null;
      }
    },
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post("/invoices", payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

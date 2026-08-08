import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

export function useInvoices(status?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["invoices", status, accessToken],
    queryFn: async () => {
      if (!accessToken) return [];
      try {
        const res = await apiClient.get("/invoices", { params: { status } });
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

export function useInvoice(id: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["invoice", id, accessToken],
    queryFn: async () => {
      if (!accessToken || !id) return null;
      try {
        const res = await apiClient.get(`/invoices/${id}`);
        const resData = res.data;
        return resData?.data?.data || resData?.data || resData;
      } catch (e) {
        return null;
      }
    },
    enabled: !!accessToken && !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/invoices", payload);
      const resData = res.data;
      return resData?.data?.data || resData?.data || resData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

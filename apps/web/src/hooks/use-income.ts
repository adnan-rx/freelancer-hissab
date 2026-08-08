import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

export function useIncome() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["income", accessToken],
    queryFn: async () => {
      if (!accessToken) return [];
      try {
        const res = await apiClient.get("/income");
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

export function useCreateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/income", payload);
      const resData = res.data;
      return resData?.data?.data || resData?.data || resData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useDeleteIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/income/${id}`);
      const resData = res.data;
      return resData?.data?.data || resData?.data || resData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

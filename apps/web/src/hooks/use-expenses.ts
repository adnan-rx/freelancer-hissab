import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

export function useExpenses() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["expenses", accessToken],
    queryFn: async () => {
      if (!accessToken) return [];
      try {
        const res = await apiClient.get("/expenses");
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

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/expenses", payload);
      const resData = res.data;
      return resData?.data?.data || resData?.data || resData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

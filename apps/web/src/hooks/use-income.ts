import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useIncome() {
  return useQuery({
    queryKey: ["income"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get("/income");
        return data.data || [];
      } catch (e) {
        return [];
      }
    },
  });
}

export function useCreateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post("/income", payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

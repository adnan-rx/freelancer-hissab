import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

/** Mirrors the `expense_category` enum accepted by the API. */
export const EXPENSE_CATEGORIES = [
  { value: "software", label: "Software & Subscriptions" },
  { value: "hardware", label: "Hardware & Laptops" },
  { value: "internet", label: "Internet & Fiber Broadband" },
  { value: "office", label: "Co-working & Office Rent" },
  { value: "travel", label: "Travel & Transport" },
  { value: "food", label: "Meals & Entertainment" },
  { value: "marketing", label: "Marketing & Advertising" },
  { value: "education", label: "Courses & Education" },
  { value: "tax", label: "FBR Taxes & Accounting" },
  { value: "other", label: "Other Operational Expenses" },
] as const;

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["expenses"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  queryClient.invalidateQueries({ queryKey: ["filing-readiness"] });
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
}

export function useExpenses() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["expenses", accessToken],
    queryFn: async () => {
      if (!accessToken) return [];
      const res = await apiClient.get("/expenses");
      const resData = res.data;
      const list = resData?.data?.data || resData?.data || resData || [];
      return Array.isArray(list) ? list : [];
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
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; [key: string]: any }) => {
      const res = await apiClient.patch(`/expenses/${id}`, payload);
      const resData = res.data;
      return resData?.data?.data || resData?.data || resData;
    },
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/expenses/${id}`);
      const resData = res.data;
      return resData?.data?.data || resData?.data || resData;
    },
    onSuccess: () => invalidateAll(queryClient),
  });
}

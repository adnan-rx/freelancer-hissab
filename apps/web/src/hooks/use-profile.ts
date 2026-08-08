import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useProfile() {
  return useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get("/users/profile");
        return data.data || null;
      } catch (e) {
        return null;
      }
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.patch("/users/profile", payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}

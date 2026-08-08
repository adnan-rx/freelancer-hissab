import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

export function useProfile() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["user-profile", accessToken],
    queryFn: async () => {
      if (!accessToken) return null;
      try {
        const res = await apiClient.get("/users/profile");
        const resData = res.data;
        // Handle double-nested or single-nested backend response payload
        const userObj = resData?.data?.data || resData?.data || resData;
        return userObj || null;
      } catch (e) {
        console.warn("Failed to fetch user profile:", e);
        return null;
      }
    },
    enabled: !!accessToken,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.patch("/users/profile", payload);
      const resData = res.data;
      return resData?.data?.data || resData?.data || resData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}

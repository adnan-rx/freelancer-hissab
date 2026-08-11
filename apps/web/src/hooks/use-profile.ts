import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { unwrapApi } from "@/lib/utils";

export function useProfile() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["user-profile", accessToken],
    queryFn: async () => {
      const res = await apiClient.get("/users/profile");
      return unwrapApi(res);
    },
    enabled: !!accessToken,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.patch("/users/profile", payload);
      return unwrapApi(res);
    },
    // settings/page.tsx shows its own success/error toast and needs the
    // result to update the auth store's cached user.
    meta: { suppressErrorToast: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}

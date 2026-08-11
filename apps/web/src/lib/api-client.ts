import axios from "axios";
import { useAuthStore } from "../stores/auth.store";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1",
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshSubscribers: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function onRefreshed(newToken: string) {
  refreshSubscribers.forEach((sub) => sub.resolve(newToken));
  refreshSubscribers = [];
}

// A failed refresh used to leave every queued request unresolved forever —
// nothing ever called their promise's reject, so a panel that triggered the
// queueing spun indefinitely instead of showing an error or redirecting.
function onRefreshFailed(error: unknown) {
  refreshSubscribers.forEach((sub) => sub.reject(error));
  refreshSubscribers = [];
}

function addRefreshSubscriber(resolve: (token: string) => void, reject: (error: unknown) => void) {
  refreshSubscribers.push({ resolve, reject });
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    const isAuthRoute =
      originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/register") ||
      originalRequest?.url?.includes("/auth/refresh");

    if (status === 401 && !isAuthRoute && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          addRefreshSubscriber(
            (newToken: string) => {
              // Marked before retrying so a second 401 on this same request
              // falls through to a normal rejection instead of re-entering
              // the refresh flow and potentially looping.
              originalRequest._retry = true;
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(apiClient(originalRequest));
            },
            (refreshError: unknown) => reject(refreshError),
          );
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(
          `${apiClient.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        // Backend wraps responses in { success, data, error } via TransformInterceptor
        const refreshData = response.data.data || response.data;

        useAuthStore.getState().setTokens(refreshData.accessToken);
        // The refresh response also returns the current user; applying it
        // keeps the store in sync with any profile changes made elsewhere,
        // which the token-only update used to silently drop.
        if (refreshData.user) {
          useAuthStore.getState().setUser(refreshData.user);
        }

        originalRequest.headers.Authorization = `Bearer ${refreshData.accessToken}`;
        onRefreshed(refreshData.accessToken);

        return apiClient(originalRequest);
      } catch (refreshError: any) {
        onRefreshFailed(refreshError);
        useAuthStore.getState().logout();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

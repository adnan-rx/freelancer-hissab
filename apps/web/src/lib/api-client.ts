import axios from "axios";
import { useAuthStore } from "../stores/auth.store";

export const apiClient = axios.create({
  baseURL: "http://localhost:3001/api/v1",
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only logout and redirect if 401 occurs on NON-auth routes (not /auth/login or /auth/register)
    const isAuthRoute = error.config?.url?.includes("/auth/login") || error.config?.url?.includes("/auth/register");
    if (error.response?.status === 401 && !isAuthRoute) {
      useAuthStore.getState().logout();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

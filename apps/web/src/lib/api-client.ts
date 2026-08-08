import axios from "axios";
import { useAuthStore } from "../stores/auth.store";

export const apiClient = axios.create({
  baseURL: "http://localhost:3001/api/v1",
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  console.log(`[INTERCEPTOR] 📤 Request: ${config.method?.toUpperCase()} ${config.url}`);
  console.log(`[INTERCEPTOR] Access token present?`, !!token);
  if (token) {
    console.log(`[INTERCEPTOR] Access token (first 30 chars):`, token.substring(0, 30) + '...');
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(newToken: string) {
  console.log(`[INTERCEPTOR] Notifying ${refreshSubscribers.length} queued requests with new token`);
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

apiClient.interceptors.response.use(
  (response) => {
    console.log(`[INTERCEPTOR] ✅ Response OK: ${response.config.method?.toUpperCase()} ${response.config.url} → ${response.status}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = originalRequest?.url;
    
    console.log(`[INTERCEPTOR] ❌ Response ERROR: ${originalRequest?.method?.toUpperCase()} ${url} → ${status}`);
    console.log(`[INTERCEPTOR] Error data:`, error.response?.data);

    const isAuthRoute =
      originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/register") ||
      originalRequest?.url?.includes("/auth/refresh");

    console.log(`[INTERCEPTOR] Is auth route?`, isAuthRoute);
    console.log(`[INTERCEPTOR] Is retry?`, !!originalRequest._retry);

    if (status === 401 && !isAuthRoute && !originalRequest._retry) {
      console.log(`[INTERCEPTOR] 🔄 Got 401 on non-auth route, attempting token refresh...`);
      
      const refreshToken = useAuthStore.getState().refreshToken;
      console.log(`[INTERCEPTOR] Refresh token present?`, !!refreshToken);
      console.log(`[INTERCEPTOR] Refresh token (first 30 chars):`, refreshToken?.substring(0, 30) + '...');

      if (!refreshToken) {
        console.log(`[INTERCEPTOR] ⛔ No refresh token available → LOGOUT`);
        useAuthStore.getState().logout();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        console.log(`[INTERCEPTOR] ⏳ Another refresh is already in-flight, queuing this request`);
        return new Promise((resolve) => {
          addRefreshSubscriber((newToken: string) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      console.log(`[INTERCEPTOR] 📡 Sending POST /auth/refresh...`);

      try {
        const response = await axios.post(
          `${apiClient.defaults.baseURL}/auth/refresh`,
          { refreshToken }
        );
        
        console.log(`[INTERCEPTOR] ✅ Refresh response received!`);
        console.log(`[INTERCEPTOR] Raw response data shape:`, Object.keys(response.data));
        
        // Backend wraps responses in { success, data, error } via TransformInterceptor
        const refreshData = response.data.data || response.data;
        
        console.log(`[INTERCEPTOR] New access token (first 30 chars):`, refreshData.accessToken?.substring(0, 30) + '...');
        console.log(`[INTERCEPTOR] New refresh token (first 30 chars):`, refreshData.refreshToken?.substring(0, 30) + '...');
        console.log(`[INTERCEPTOR] Response has user?`, !!refreshData.user);
        
        useAuthStore.getState().setTokens(refreshData.accessToken, refreshData.refreshToken);
        
        // Verify the store was updated
        const storeState = useAuthStore.getState();
        console.log(`[INTERCEPTOR] Store updated - accessToken matches?`, storeState.accessToken === refreshData.accessToken);
        console.log(`[INTERCEPTOR] Store updated - refreshToken matches?`, storeState.refreshToken === refreshData.refreshToken);
        console.log(`[INTERCEPTOR] Store updated - isAuthenticated?`, storeState.isAuthenticated);
        
        originalRequest.headers.Authorization = `Bearer ${refreshData.accessToken}`;
        onRefreshed(refreshData.accessToken);
        
        console.log(`[INTERCEPTOR] 🔁 Retrying original request: ${originalRequest.method?.toUpperCase()} ${originalRequest.url}`);
        return apiClient(originalRequest);
      } catch (refreshError: any) {
        console.error(`[INTERCEPTOR] ❌ REFRESH FAILED!`);
        console.error(`[INTERCEPTOR] Refresh error status:`, refreshError.response?.status);
        console.error(`[INTERCEPTOR] Refresh error data:`, refreshError.response?.data);
        console.error(`[INTERCEPTOR] Refresh error message:`, refreshError.message);
        console.log(`[INTERCEPTOR] ⛔ Refresh token invalid/expired → LOGOUT`);
        useAuthStore.getState().logout();
        window.location.href = "/login";
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);


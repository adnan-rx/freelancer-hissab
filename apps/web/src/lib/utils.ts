import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPKR(amount: number | string) {
  const numeric = typeof amount === "number" ? amount : parseFloat(String(amount || 0));
  const valid = isNaN(numeric) ? 0 : numeric;
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(valid);
}

export function formatUSD(amount: number | string) {
  const numeric = typeof amount === "number" ? amount : parseFloat(String(amount || 0));
  const valid = isNaN(numeric) ? 0 : numeric;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(valid);
}

/**
 * Turns an axios/API failure into a message worth showing a user.
 * The API wraps errors as { error: { code, message, details } }; validation
 * failures put the useful text in `details`.
 */
export function apiErrorMessage(err: any, fallback = "Something went wrong. Please try again."): string {
  const apiError = err?.response?.data?.error;

  if (Array.isArray(apiError?.details) && apiError.details.length > 0) {
    return apiError.details.join(", ");
  }
  if (typeof apiError?.message === "string" && apiError.message) {
    return apiError.message;
  }
  if (err?.response?.status === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (err?.code === "ERR_NETWORK" || err?.message === "Network Error") {
    return "Cannot reach the server. Check that the API is running and try again.";
  }
  return err?.message || fallback;
}

/**
 * Every API response is wrapped once as `{ success, data, error }` by the
 * backend's TransformInterceptor, so the payload always lives at `res.data.data`.
 * Hooks used to guess between three possible shapes
 * (`resData?.data?.data || resData?.data || resData`) "just in case" — that
 * guessing hid real contract breaks by quietly falling back to the wrapper
 * object instead of failing loudly.
 */
export function unwrapApi<T = any>(res: { data?: { data?: T } }): T {
  return res.data?.data as T;
}

export function formatDate(date: string | Date) {
  if (!date) return "N/A";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
    }).format(new Date(date));
  } catch {
    return String(date);
  }
}

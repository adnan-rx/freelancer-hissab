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

/**
 * Axis-and-chip sized PKR: "Rs 1.2M" instead of "PKR 1,240,880". Full precision
 * still belongs in tables and tooltips — this is only for cramped labels.
 */
export function formatCompactPKR(amount: number | string) {
  const numeric = typeof amount === "number" ? amount : parseFloat(String(amount || 0));
  const valid = isNaN(numeric) ? 0 : numeric;
  if (valid === 0) return "Rs 0";
  return `Rs ${new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(valid)}`;
}

/**
 * Any billing currency, formatted the same way. The pages used to special-case
 * USD and fall through to a bare `${code} ${amount}` for everything else, so a
 * EUR total printed as "EUR 2870.00" beside "$4,180.00" — same table, two
 * different conventions, and no thousands separator on one of them.
 */
export function formatMoney(amount: number | string, currency = "USD") {
  const numeric = typeof amount === "number" ? amount : parseFloat(String(amount || 0));
  const valid = isNaN(numeric) ? 0 : numeric;
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(code === "PKR" ? "en-PK" : "en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: code === "PKR" ? 0 : 2,
    }).format(valid);
  } catch {
    // Unknown/non-ISO code: still print grouped digits rather than a raw float.
    return `${code} ${valid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

/** @deprecated Prefer `formatMoney(amount, currency)` — kept for external callers. */
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

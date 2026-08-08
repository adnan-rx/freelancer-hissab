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

export function formatDate(date: string | Date) {
  if (!date) return "N/A";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
    }).format(new Date(date));
  } catch (e) {
    return String(date);
  }
}

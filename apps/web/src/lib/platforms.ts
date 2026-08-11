/**
 * Display names for the platform keys the API stores lowercase.
 * Shared so the dashboard and reports never label the same platform differently.
 */
export const PLATFORM_LABELS: Record<string, string> = {
  upwork: "Upwork escrow",
  fiverr: "Fiverr orders",
  direct: "Direct bank / Wise",
  freelancer: "Freelancer.com",
  other: "Other local client",
};

export function platformLabel(key: string | undefined | null): string {
  if (!key) return "Unspecified";
  return PLATFORM_LABELS[String(key).toLowerCase()] ?? key;
}

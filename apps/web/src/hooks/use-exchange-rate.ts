import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { unwrapApi } from "@/lib/utils";

export function useExchangeRate(fromCurrency: string = "USD") {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["exchange-rate", fromCurrency, accessToken],
    queryFn: async () => {
      if (fromCurrency === "PKR") return 1.0;
      const res = await apiClient.get("/exchange-rate/convert", {
        params: { from: fromCurrency, amount: 1 },
      });
      // No hardcoded fallback: a failed fetch used to silently return 280.50,
      // which misstated foreign-currency invoices/income by however much the
      // real rate had moved. Callers already tolerate `data` being undefined
      // while this loads or fails (they keep whatever rate was last entered).
      return unwrapApi<{ exchangeRate: number }>(res).exchangeRate;
    },
    enabled: !!accessToken && !!fromCurrency,
  });
}

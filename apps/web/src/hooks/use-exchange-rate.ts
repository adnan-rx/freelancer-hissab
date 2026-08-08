import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

export function useExchangeRate(fromCurrency: string = "USD") {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["exchange-rate", fromCurrency, accessToken],
    queryFn: async () => {
      if (fromCurrency === "PKR") return 1.0;
      if (!accessToken) return 280.50;
      try {
        const res = await apiClient.get("/exchange-rate/convert", {
          params: { from: fromCurrency, amount: 1 },
        });
        const resData = res.data;
        const dataObj = resData?.data?.data || resData?.data || resData;
        return dataObj?.exchangeRate || 280.50;
      } catch (e) {
        return 280.50;
      }
    },
    enabled: !!accessToken && !!fromCurrency,
  });
}

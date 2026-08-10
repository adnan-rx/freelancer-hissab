"use client";

import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "./toast-provider";
import { apiErrorMessage } from "@/lib/utils";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const { showError } = useToast();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
        // A mutation failure used to be invisible unless the page that
        // triggered it happened to wire up its own try/catch + toast — most
        // didn't. This is the backstop: every mutation error now surfaces a
        // toast by default. A call site opts out via `meta.suppressErrorToast`
        // only when it already gives more specific feedback (an inline form
        // error, or a "needs confirmation" flow like force-deleting a client).
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (mutation.meta?.suppressErrorToast) return;
            showError(apiErrorMessage(error, "Something went wrong. Please try again."));
          },
        }),
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { unwrapApi } from "@/lib/utils";

export function useInvoices(status?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["invoices", status, accessToken],
    queryFn: async () => {
      const res = await apiClient.get("/invoices", { params: { status } });
      const list = unwrapApi<any[]>(res);
      return Array.isArray(list) ? list : [];
    },
    enabled: !!accessToken,
  });
}

export function useInvoice(id: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  // Does not retry: the detail page needs to tell a genuine 404 apart from
  // "still loading" instead of rendering fabricated placeholder data.
  return useQuery({
    queryKey: ["invoice", id, accessToken],
    queryFn: async () => {
      const res = await apiClient.get(`/invoices/${id}`);
      return unwrapApi(res);
    },
    enabled: !!accessToken && !!id,
    retry: false,
  });
}

/** The server's next sequential invoice number for the signed-in user's prefix. */
export function useNextInvoiceNumber() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["next-invoice-number", accessToken],
    queryFn: async () => {
      const res = await apiClient.get("/invoices/next-number");
      return unwrapApi<{ invoiceNumber: string }>(res).invoiceNumber;
    },
    enabled: !!accessToken,
    staleTime: 0,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/invoices", payload);
      return unwrapApi(res);
    },
    // invoices/new/page.tsx shows its own error toast and needs to know
    // whether the call succeeded before it navigates away.
    meta: { suppressErrorToast: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["next-invoice-number"] });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/invoices/${id}`);
      return unwrapApi(res);
    },
    // Single vs. bulk delete show their own success/failure counts.
    meta: { suppressErrorToast: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await apiClient.patch(`/invoices/${id}`, payload);
      return unwrapApi(res);
    },
    meta: { suppressErrorToast: true },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["filing-readiness"] });
    },
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiClient.patch(`/invoices/${id}/status`, { status });
      return unwrapApi(res);
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["filing-readiness"] });
      // Marking an invoice paid now records the matching income server-side.
      queryClient.invalidateQueries({ queryKey: ["income"] });
    },
  });
}

"use client";

import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { useToast } from "@/providers/toast-provider";
import { apiErrorMessage, unwrapApi, formatDate, cn } from "@/lib/utils";

interface EvidenceVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordId: string | null;
  recordType: 'income' | 'expense';
  recordTitle?: string;
}

export function EvidenceVaultModal({ isOpen, onClose, recordId, recordType, recordTitle }: EvidenceVaultModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { showSuccess, showError } = useToast();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['evidence', recordType, recordId, accessToken],
    queryFn: async () => {
      const res = await apiClient.get(`/evidence/${recordType}/${recordId}`);
      const list = unwrapApi<any[]>(res);
      return Array.isArray(list) ? list : [];
    },
    enabled: isOpen && !!recordId && !!accessToken,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', recordType === 'income' ? 'PRC' : 'RECEIPT');
      formData.append(recordType === 'income' ? 'incomeId' : 'expenseId', recordId!);

      const res = await apiClient.post('/evidence/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return unwrapApi(res);
    },
    // Handled locally so the message can be paired with clearing the upload spinner.
    meta: { suppressErrorToast: true },
    onSuccess: (doc: any) => {
      queryClient.invalidateQueries({ queryKey: ['evidence', recordType, recordId] });
      setIsUploading(false);
      showSuccess(`"${doc?.fileName || 'Document'}" uploaded.`, "Evidence uploaded");
    },
    onError: (err) => {
      setIsUploading(false);
      showError(apiErrorMessage(err, "Failed to upload file."), "Upload failed");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      await apiClient.delete(`/evidence/${docId}`);
    },
    meta: { suppressErrorToast: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', recordType, recordId] });
      showSuccess("Document removed.", "Evidence deleted");
    },
    onError: (err) => {
      // Previously had no onError at all — a failed delete left the document
      // listed with no explanation.
      showError(apiErrorMessage(err, "Failed to delete the document."), "Couldn't delete document");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      uploadMutation.mutate(e.target.files[0]);
    }
  };

  /**
   * Evidence is stored as a private blob (see H-19), so it can no longer be
   * linked to directly — a plain <a href> would hit an authenticated download
   * route with no Authorization header and 401. Fetch it through the shared
   * axios client instead and open the result as a local blob URL.
   */
  const handleView = async (doc: any) => {
    setOpeningDocId(doc.id);
    try {
      const res = await apiClient.get(`/evidence/${doc.id}/download`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      // Give the new tab time to load the object URL before revoking it.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      showError(apiErrorMessage(err, "Failed to open the document."), "Couldn't open document");
    } finally {
      setOpeningDocId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Evidence</DialogTitle>
          <DialogDescription>
            {recordType === 'income'
              ? "PRCs and remittance advice for "
              : "Receipts and invoices for "}
            <span className="font-medium text-foreground">
              {recordTitle || (recordType === 'income' ? "this income entry" : "this expense")}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <button
            type="button"
            onClick={() => !isUploading && fileInputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              "flex w-full flex-col items-center rounded-lg border-2 border-dashed p-8 text-center transition-colors duration-150 ease-smooth",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2",
              isUploading
                ? "border-brand-400 bg-brand-50"
                : "border-border-strong bg-muted/40 hover:border-brand-400 hover:bg-muted"
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
            />
            <span
              className="flex size-11 items-center justify-center rounded-md bg-brand-50 text-brand-700"
              aria-hidden="true"
            >
              {isUploading ? <Loader2 className="size-5 animate-spin" /> : <UploadCloud className="size-5" />}
            </span>
            <span className="mt-4 text-sm font-medium text-foreground">
              {isUploading ? "Uploading…" : "Click to upload a document"}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">PDF, JPG or PNG, up to 5MB</span>
          </button>

          <div>
            <p className="mb-3 text-2xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Attached documents
            </p>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-md" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-md border border-dashed border-border-strong bg-muted/30">
                <EmptyState
                  size="sm"
                  title="Nothing attached yet"
                  description={
                    recordType === 'income'
                      ? "A PRC or bank advice here is what proves this was export income."
                      : "A receipt here backs up the deduction if you're ever asked."
                  }
                />
              </div>
            ) : (
              <ul className="space-y-2">
                {documents.map((doc: any) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3 transition-colors duration-150 hover:bg-muted/50"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground"
                        aria-hidden="true"
                      >
                        {String(doc.fileType || "").includes('image') ? (
                          <ImageIcon className="size-4" />
                        ) : (
                          <FileText className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <button
                          type="button"
                          onClick={() => handleView(doc)}
                          disabled={openingDocId === doc.id}
                          className="block max-w-full truncate rounded-sm text-left text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:opacity-60"
                        >
                          {openingDocId === doc.id ? "Opening…" : doc.fileName}
                        </button>
                        <span className="block text-xs text-muted-foreground tabular">
                          {Math.round(doc.fileSize / 1024)} KB · {formatDate(doc.createdAt)}
                        </span>
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 hover:bg-destructive-surface hover:text-destructive"
                      onClick={() => deleteMutation.mutate(doc.id)}
                      disabled={deleteMutation.isPending}
                      title="Delete document"
                    >
                      <Trash2 />
                      <span className="sr-only">Delete {doc.fileName}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

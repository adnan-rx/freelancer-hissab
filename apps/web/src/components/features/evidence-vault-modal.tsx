import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { useToast } from "@/providers/toast-provider";
import { apiErrorMessage, unwrapApi } from "@/lib/utils";

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
      showSuccess(`"${doc?.fileName || 'Document'}" uploaded.`, "Evidence Uploaded");
    },
    onError: (err) => {
      setIsUploading(false);
      showError(apiErrorMessage(err, "Failed to upload file."), "Upload Failed");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      await apiClient.delete(`/evidence/${docId}`);
    },
    meta: { suppressErrorToast: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', recordType, recordId] });
      showSuccess("Document removed.", "Evidence Deleted");
    },
    onError: (err) => {
      // Previously had no onError at all — a failed delete left the document
      // listed with no explanation.
      showError(apiErrorMessage(err, "Failed to delete the document."), "Delete Failed");
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
      showError(apiErrorMessage(err, "Failed to open the document."), "Could Not Open Document");
    } finally {
      setOpeningDocId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] bg-background rounded-3xl border-border/50 shadow-sm overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 bg-muted/20">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Evidence Vault
          </DialogTitle>
          <DialogDescription>
            Manage supporting documents for {recordTitle || (recordType === 'income' ? 'this income record' : 'this expense record')}.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer
              ${isUploading ? 'border-primary/50 bg-primary/5' : 'border-border/60 hover:border-primary/50 hover:bg-muted/30'}`}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
            />
            {isUploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
                <p className="text-sm font-semibold text-foreground">Uploading to secure vault...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">Click to upload document</p>
                <p className="text-xs text-muted-foreground">Supports PDF, JPG, PNG (Max 5MB)</p>
              </div>
            )}
          </div>

          {/* Document List */}
          <div>
            <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Attached Documents</h4>

            {isLoading ? (
              <div className="text-center py-4 text-sm text-muted-foreground">Loading documents...</div>
            ) : documents.length === 0 ? (
              <div className="text-center py-6 bg-muted/20 rounded-xl border border-dashed border-border/50 text-sm text-muted-foreground">
                No evidence attached yet.
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="h-10 w-10 rounded-lg bg-background border border-border/50 flex items-center justify-center shrink-0 text-primary">
                        {doc.fileType.includes('image') ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => handleView(doc)}
                          disabled={openingDocId === doc.id}
                          className="text-sm font-semibold text-foreground hover:text-primary truncate block text-left disabled:opacity-60"
                        >
                          {openingDocId === doc.id ? "Opening…" : doc.fileName}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          {Math.round(doc.fileSize / 1024)} KB • {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => deleteMutation.mutate(doc.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

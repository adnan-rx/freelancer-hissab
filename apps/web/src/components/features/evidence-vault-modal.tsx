import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";

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
  const accessToken = useAuthStore((state) => state.accessToken);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['evidence', recordType, recordId, accessToken],
    queryFn: async () => {
      if (!recordId || !accessToken) return [];
      const res = await apiClient.get(`/evidence/${recordType}/${recordId}`);
      return res.data?.data || res.data || [];
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
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', recordType, recordId] });
      setIsUploading(false);
    },
    onError: () => {
      setIsUploading(false);
      alert("Failed to upload file");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      await apiClient.delete(`/evidence/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', recordType, recordId] });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      uploadMutation.mutate(e.target.files[0]);
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
                        <a href={doc.blobUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-foreground hover:text-primary truncate block">
                          {doc.fileName}
                        </a>
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

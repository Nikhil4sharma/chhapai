import { useState } from 'react';
import { FileText, Eye, ExternalLink, FileImage, Trash2, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { OrderFile } from '@/types/order';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';

interface FilePreviewProps {
  files: OrderFile[];
  compact?: boolean;
  onFileDeleted?: () => void;
  canDelete?: boolean;
  orderId?: string;
  itemId?: string;
  productName?: string;
}

export function FilePreview({ files, compact = false, onFileDeleted, canDelete = true, orderId, itemId, productName }: FilePreviewProps) {
  const { user, isAdmin, role, profile } = useAuth();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<OrderFile | null>(null);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Check if user can delete a specific file
  const canDeleteFile = (file: OrderFile) => {
    if (!canDelete) return false;
    // Uploader, admin, or sales can delete
    return file.uploaded_by === user?.uid || isAdmin || role === 'sales';
  };

  if (!files || files.length === 0) return null;

  const isImage = (fileName: string | undefined, fileUrl?: string) => {
    if (!fileName && !fileUrl) return false;
    const name = fileName || fileUrl || '';
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
  };

  const isPdf = (fileName: string | undefined, fileUrl?: string) => {
    if (!fileName && !fileUrl) return false;
    const name = fileName || fileUrl || '';
    return /\.pdf$/i.test(name);
  };

  const getFileName = (file: OrderFile) => file.file_name || file.url.split('/').pop() || 'File';

  const handlePreview = (file: OrderFile) => {
    setSelectedFile(file);
    setPreviewOpen(true);
  };

  const handleDeleteFile = async () => {
    if (!deleteFileId || !selectedFile) return;
    
    setIsDeleting(true);
    try {
      const fileName = getFileName(selectedFile);
      
      // Delete the file from Firestore
      await deleteDoc(doc(db, 'order_files', deleteFileId));

      // Add timeline entry for file deletion (history preservation)
      if (orderId && user && profile) {
        const { collection, setDoc, Timestamp } = await import('firebase/firestore');
        await setDoc(doc(collection(db, 'timeline')), {
          order_id: orderId,
          item_id: itemId || null,
          product_name: productName || null,
          stage: 'sales', // Default stage for file deletion
          action: 'note_added',
          performed_by: user.uid,
          performed_by_name: profile.full_name || 'Unknown',
          notes: `File deleted: ${fileName}`,
          attachments: [{ url: selectedFile.url, type: selectedFile.type }], // Keep file URL in history
          is_public: true,
          created_at: Timestamp.now(),
        });
      }

      toast({
        title: "File deleted",
        description: "The file has been removed successfully. It will remain in the history.",
      });

      setPreviewOpen(false);
      setSelectedFile(null);
      onFileDeleted?.();
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteFileId(null);
    }
  };

  const renderPreviewContent = () => {
    if (!selectedFile) return null;
    const fileName = getFileName(selectedFile);
    const fileIsPdf = isPdf(fileName, selectedFile.url);
    const fileIsImage = isImage(fileName, selectedFile.url);

    // PDF preview using Google Docs Viewer
    if (fileIsPdf) {
      const encodedUrl = encodeURIComponent(selectedFile.url);
      const googleDocsViewerUrl = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
      
      return (
        <div className="w-full h-[calc(95vh-180px)] min-h-[400px]">
          <iframe
            src={googleDocsViewerUrl}
            className="w-full h-full rounded-lg border border-border"
            title={fileName}
            allow="fullscreen"
          />
        </div>
      );
    }

    // Image preview - responsive and centered
    if (fileIsImage) {
      return (
        <div className="flex items-center justify-center w-full h-full overflow-hidden bg-muted/30 rounded-lg p-4">
          <img
            src={selectedFile.url}
            alt={fileName}
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
            onError={(e) => {
              // Fallback if image fails to load
              const target = e.currentTarget;
              const parent = target.parentElement;
              if (parent) {
                target.style.display = 'none';
                const fallback = document.createElement('div');
                fallback.className = 'flex flex-col items-center justify-center py-12 text-center';
                fallback.innerHTML = `
                  <svg class="h-16 w-16 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  <p class="text-muted-foreground mb-4">Image preview not available</p>
                  <button onclick="window.open('${selectedFile.url}', '_blank')" class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                    Open File
                  </button>
                `;
                parent.appendChild(fallback);
              }
            }}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
        <Button onClick={() => window.open(selectedFile.url, '_blank')}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Open File
        </Button>
      </div>
    );
  };

  const FileButton = ({ file }: { file: OrderFile }) => {
    const fileName = getFileName(file);
    const fileIsImage = isImage(fileName, file.url);
    const fileIsPdf = isPdf(fileName, file.url);

    const buttonContent = (
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-1.5 hover:bg-accent/50 transition-colors"
        onClick={() => handlePreview(file)}
      >
        {fileIsImage || fileIsPdf ? (
          <div className="relative h-16 w-20 rounded-md overflow-hidden border border-border group flex-shrink-0">
            <img 
              src={file.url} 
              alt={fileName}
              className="h-full w-full object-contain bg-muted/50 transition-transform group-hover:scale-105"
              onError={(e) => {
                // Fallback icon if image fails to load
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.file-icon-fallback')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'file-icon-fallback flex items-center justify-center h-full w-full bg-muted';
                  if (fileIsPdf) {
                    fallback.className += ' bg-red-500/10';
                    fallback.innerHTML = '<svg class="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>';
                  } else {
                    fallback.innerHTML = '<svg class="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                  }
                  parent.appendChild(fallback);
                }
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {fileIsPdf && (
              <div className="absolute top-1 right-1 bg-red-500 text-white text-[8px] px-1 rounded font-semibold">
                PDF
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2 py-1 bg-secondary rounded-md border border-border">
            <FileImage className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs max-w-[80px] truncate">{fileName}</span>
          </div>
        )}
      </Button>
    );

    if (fileIsImage || fileIsPdf) {
      return (
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild className="z-10">
            {buttonContent}
          </HoverCardTrigger>
          <HoverCardContent className="w-auto max-w-lg p-2 z-[100] overflow-visible" side="top" sideOffset={8}>
            {fileIsPdf ? (
              // PDF hover preview - show Google Docs viewer
              <div className="w-full h-64">
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(file.url)}&embedded=true`}
                  className="w-full h-full rounded-md border border-border"
                  title={fileName}
                />
              </div>
            ) : (
              // Image hover preview - full image visible, no cut
              <div className="max-w-lg max-h-[500px] overflow-auto">
                <img
                  src={file.url}
                  alt={fileName}
                  className="w-full h-auto max-h-[500px] object-contain rounded-md"
                  style={{ maxWidth: '100%', objectFit: 'contain' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center mt-2 truncate">{fileName}</p>
          </HoverCardContent>
        </HoverCard>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
        <TooltipContent>{fileName}</TooltipContent>
      </Tooltip>
    );
  };

  const PreviewDialog = () => (
    <>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] w-[95vw] p-0 gap-0 overflow-hidden flex flex-col [&>button]:hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="truncate text-sm sm:text-base font-semibold">{selectedFile && getFileName(selectedFile)}</span>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPreviewOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!selectedFile) return;
                    try {
                      const fileName = getFileName(selectedFile);
                      const link = document.createElement('a');
                      link.href = selectedFile.url;
                      link.download = fileName;
                      link.target = '_blank';
                      link.rel = 'noopener noreferrer';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      
                      toast({
                        title: "Download Started",
                        description: `Downloading ${fileName}...`,
                      });
                    } catch (error) {
                      console.error('Download error:', error);
                      toast({
                        title: "Download Failed",
                        description: "Failed to download file. Please try opening in a new tab.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(selectedFile?.url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Open</span>
                </Button>
                {selectedFile && canDeleteFile(selectedFile) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteFileId(selectedFile.file_id)}
                  >
                    <Trash2 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-6 min-h-0 flex items-center justify-center">
            {renderPreviewContent()}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFileId} onOpenChange={() => setDeleteFileId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFile}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {files.slice(0, 4).map((file) => (
            <FileButton key={file.file_id} file={file} />
          ))}
          {files.length > 4 && (
            <Badge variant="secondary" className="text-xs h-8 px-2">
              +{files.length - 4}
            </Badge>
          )}
        </div>
        <PreviewDialog />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mt-2">
        {files.map((file) => (
          <FileButton key={file.file_id} file={file} />
        ))}
      </div>
      <PreviewDialog />
    </>
  );
}

import { useState } from 'react';
import { FileText, Eye, ExternalLink, FileImage, Trash2, Download } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface FilePreviewProps {
  files: OrderFile[];
  compact?: boolean;
  onFileDeleted?: () => void;
  canDelete?: boolean;
}

export function FilePreview({ files, compact = false, onFileDeleted, canDelete = true }: FilePreviewProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<OrderFile | null>(null);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!files || files.length === 0) return null;

  const isImage = (fileName: string | undefined) => {
    if (!fileName) return false;
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  };

  const isPdf = (fileName: string | undefined) => {
    if (!fileName) return false;
    return /\.pdf$/i.test(fileName);
  };

  const getFileName = (file: OrderFile) => file.file_name || file.url.split('/').pop() || 'File';

  const handlePreview = (file: OrderFile) => {
    setSelectedFile(file);
    setPreviewOpen(true);
  };

  const handleDeleteFile = async () => {
    if (!deleteFileId) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('order_files')
        .delete()
        .eq('id', deleteFileId);

      if (error) throw error;

      toast({
        title: "File deleted",
        description: "The file has been removed successfully.",
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

    if (isImage(fileName)) {
      return (
        <div className="flex items-center justify-center overflow-auto max-h-[75vh]">
          <img
            src={selectedFile.url}
            alt={fileName}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      );
    }

    if (isPdf(fileName)) {
      return (
        <div className="w-full h-[75vh]">
          <iframe
            src={selectedFile.url}
            className="w-full h-full rounded-lg border border-border"
            title={fileName}
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
    const fileIsImage = isImage(fileName);
    const fileIsPdf = isPdf(fileName);

    const buttonContent = (
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-1.5 hover:bg-accent/50 transition-colors"
        onClick={() => handlePreview(file)}
      >
        {fileIsImage ? (
          <div className="relative h-14 w-14 rounded-md overflow-hidden border border-border group">
            <img 
              src={file.url} 
              alt={fileName}
              className="h-full w-full object-cover transition-transform group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ) : fileIsPdf ? (
          <div className="flex items-center gap-2 px-2 py-1 bg-red-500/10 rounded-md border border-red-500/20">
            <FileText className="h-5 w-5 text-red-500" />
            <span className="text-xs max-w-[80px] truncate font-medium">{fileName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2 py-1 bg-secondary rounded-md border border-border">
            <FileImage className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs max-w-[80px] truncate">{fileName}</span>
          </div>
        )}
      </Button>
    );

    if (fileIsImage) {
      return (
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            {buttonContent}
          </HoverCardTrigger>
          <HoverCardContent className="w-64 p-2" side="top">
            <img
              src={file.url}
              alt={fileName}
              className="w-full h-auto max-h-48 object-contain rounded-md"
            />
            <p className="text-xs text-muted-foreground text-center mt-2 truncate">{fileName}</p>
          </HoverCardContent>
        </HoverCard>
      );
    }

    if (fileIsPdf) {
      return (
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            {buttonContent}
          </HoverCardTrigger>
          <HoverCardContent className="w-48 p-3" side="top">
            <div className="flex flex-col items-center text-center">
              <FileText className="h-8 w-8 text-red-500 mb-2" />
              <p className="text-sm font-medium truncate w-full">{fileName}</p>
              <p className="text-xs text-muted-foreground mt-1">Click to preview PDF</p>
            </div>
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
        <DialogContent className="max-w-5xl max-h-[90vh] w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-8">
              <span className="truncate text-sm sm:text-base">{selectedFile && getFileName(selectedFile)}</span>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a href={selectedFile?.url} download target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Download</span>
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(selectedFile?.url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Open</span>
                </Button>
                {canDelete && selectedFile && (
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
          {renderPreviewContent()}
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

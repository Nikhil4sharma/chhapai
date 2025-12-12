import { useState } from 'react';
import { FileText, Image, Eye, ExternalLink, X } from 'lucide-react';
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
import { OrderFile } from '@/types/order';

interface FilePreviewProps {
  files: OrderFile[];
  compact?: boolean;
}

export function FilePreview({ files, compact = false }: FilePreviewProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<OrderFile | null>(null);

  if (!files || files.length === 0) return null;

  const isImage = (fileName: string | undefined) => {
    if (!fileName) return false;
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  };

  const getFileName = (file: OrderFile) => file.file_name || file.url.split('/').pop() || 'File';

  const handlePreview = (file: OrderFile) => {
    if (isImage(getFileName(file))) {
      setSelectedFile(file);
      setPreviewOpen(true);
    } else {
      window.open(file.url, '_blank');
    }
  };

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-2 flex-wrap">
          {files.slice(0, 3).map((file) => (
            <Tooltip key={file.file_id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => handlePreview(file)}
                >
                  {isImage(getFileName(file)) ? (
                    <div className="relative h-6 w-6 rounded overflow-hidden border border-border">
                      <img 
                        src={file.url} 
                        alt={getFileName(file)}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{getFileName(file)}</TooltipContent>
            </Tooltip>
          ))}
          {files.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{files.length - 3} more
            </Badge>
          )}
        </div>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="truncate">{selectedFile && getFileName(selectedFile)}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(selectedFile?.url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Full
                </Button>
              </DialogTitle>
            </DialogHeader>
            {selectedFile && (
              <div className="flex items-center justify-center overflow-auto max-h-[70vh]">
                <img
                  src={selectedFile.url}
                  alt={getFileName(selectedFile)}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mt-2">
        {files.map((file) => (
          <Tooltip key={file.file_id}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-auto p-1.5 gap-2"
                onClick={() => handlePreview(file)}
              >
                {isImage(getFileName(file)) ? (
                  <div className="relative h-10 w-10 rounded overflow-hidden border border-border">
                    <img 
                      src={file.url} 
                      alt={getFileName(file)}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Eye className="h-4 w-4 text-white opacity-0 hover:opacity-100" />
                    </div>
                  </div>
                ) : (
                  <>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs max-w-[100px] truncate">{getFileName(file)}</span>
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <p>{getFileName(file)}</p>
                <p className="text-xs text-muted-foreground">Click to preview</p>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate">{selectedFile && getFileName(selectedFile)}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(selectedFile?.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Full
              </Button>
            </DialogTitle>
          </DialogHeader>
          {selectedFile && (
            <div className="flex items-center justify-center overflow-auto max-h-[70vh]">
              <img
                src={selectedFile.url}
                alt={getFileName(selectedFile)}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

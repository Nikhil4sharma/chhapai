import { ReactNode, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download, ExternalLink, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  onDownload?: () => void;
  onOpen?: () => void;
  onDelete?: () => void;
  showDelete?: boolean;
  className?: string;
}

/**
 * Full-screen modal preview component
 * Works on all devices (desktop + mobile)
 * ESC key and click outside closes modal
 */
export function PreviewModal({
  open,
  onOpenChange,
  title,
  children,
  onDownload,
  onOpen,
  onDelete,
  showDelete = false,
  className,
}: PreviewModalProps) {
  // Handle ESC key
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-6xl max-h-[95vh] w-[95vw] p-0 gap-0 overflow-hidden flex flex-col',
          '[&>button.absolute]:!hidden', // Hide default close button (absolute positioned)
          className
        )}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0 bg-background">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2 flex-1 min-w-0">
              <span className="truncate text-sm sm:text-base font-semibold">
                {title}
              </span>
            </DialogTitle>
            <div className="flex gap-2 shrink-0 flex-wrap">
              {onDownload && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDownload}
                  className="flex items-center gap-2 shrink-0"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              )}
              {onOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpen}
                  className="flex items-center gap-2 shrink-0"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Open</span>
                </Button>
              )}
              {showDelete && onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive flex items-center gap-2 shrink-0"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 flex items-center justify-center shrink-0"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-4 sm:p-6 min-h-0 flex items-center justify-center bg-background">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}


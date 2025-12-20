import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronRight, Calendar, Image as ImageIcon, Eye, Download, Trash2, ExternalLink, ShoppingCart } from 'lucide-react';
import { Order, OrderFile } from '@/types/order';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PriorityBadge } from './PriorityBadge';
import { StageBadge } from './StageBadge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/contexts/OrderContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface OrderCardProps {
  order: Order;
  className?: string;
  showAssignedUser?: boolean;
}

export function OrderCard({ order, className }: OrderCardProps) {
  const mainItem = order.items[0];
  const additionalItems = order.items.length - 1;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<OrderFile | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { user, isAdmin, role, profile } = useAuth();
  const { refreshOrders, addTimelineEntry } = useOrders();

  const isImageFile = (file: OrderFile) => {
    return file.type === 'image' || file.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  };

  const handleImageClick = (file: OrderFile, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isImageFile(file)) {
      setSelectedFile(file);
      setPreviewOpen(true);
    }
  };

  const handleImagePreview = () => {
    if (!selectedFile) return null;
    const fileName = selectedFile.file_name || selectedFile.url.split('/').pop() || 'Image';
    
    return (
      <div className="flex items-center justify-center w-full h-[calc(95vh-180px)] min-h-[400px] overflow-auto bg-muted/30 rounded-lg p-4">
        <img
          src={selectedFile.url}
          alt={fileName}
          className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
          onError={(e) => {
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
              `;
              parent.appendChild(fallback);
            }
          }}
        />
      </div>
    );
  };

  const ImageThumbnail = ({ file }: { file: OrderFile }) => {
    const isImage = isImageFile(file);
    const fileName = file.file_name || file.url.split('/').pop() || 'File';

    const thumbnailContent = (
      <div
        className={cn(
          "relative h-12 w-12 rounded-md overflow-hidden border border-border bg-muted/50 flex-shrink-0 cursor-pointer group transition-all hover:scale-105 hover:border-primary/50",
          isImage && "hover:shadow-md"
        )}
        onClick={(e) => handleImageClick(file, e)}
      >
        {isImage ? (
          <>
            <img
              src={file.url}
              alt={fileName}
              className="h-full w-full object-cover transition-transform group-hover:scale-110"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.innerHTML = '<div class="h-full w-full flex items-center justify-center"><svg class="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>';
                }
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </>
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
    );

    if (isImage) {
      return (
        <HoverCard openDelay={300} closeDelay={100}>
          <HoverCardTrigger asChild>
            {thumbnailContent}
          </HoverCardTrigger>
          <HoverCardContent className="w-auto max-w-lg p-2 z-[100] overflow-visible" side="top" sideOffset={8}>
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
            <p className="text-xs text-muted-foreground text-center mt-2 truncate">{fileName}</p>
          </HoverCardContent>
        </HoverCard>
      );
    }

    return thumbnailContent;
  };

  return (
    <>
      <Card className={cn("card-hover overflow-hidden", className)}>
        <CardContent className="p-0">
          {/* Priority bar */}
          <div 
            className={cn(
              "h-1",
              order.priority_computed === 'blue' && "bg-priority-blue",
              order.priority_computed === 'yellow' && "bg-priority-yellow",
              order.priority_computed === 'red' && "bg-priority-red",
            )}
          />
          
          <div className="p-4">
            {/* Header - Order ID, Priority, Stage */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground">{order.order_id}</h3>
                <PriorityBadge priority={order.priority_computed} />
                {order.source === 'woocommerce' && (
                  <Badge variant="outline" className="text-xs">
                    <ShoppingCart className="h-3 w-3 mr-1" />
                    WooCommerce
                  </Badge>
                )}
                {order.meta?.imported && (
                  <Badge variant="secondary" className="text-xs">
                    Imported
                  </Badge>
                )}
              </div>
              {mainItem && <StageBadge stage={mainItem.current_stage} />}
            </div>

            {/* Customer Name */}
            <p className="text-sm text-muted-foreground mb-2">
              {order.customer.name}
            </p>

            {/* Delivery Date */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Calendar className="h-4 w-4" />
              <span>
                {order.order_level_delivery_date 
                  ? format(order.order_level_delivery_date, 'MMM d, yyyy')
                  : 'No date set'
                }
              </span>
              {additionalItems > 0 && (
                <span className="text-xs text-primary ml-auto">
                  +{additionalItems} item{additionalItems > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* File Thumbnails with Click and Hover Preview */}
            {mainItem && mainItem.files && mainItem.files.length > 0 && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {mainItem.files.slice(0, 3).map((file) => (
                  <ImageThumbnail key={file.file_id} file={file} />
                ))}
                {mainItem.files.length > 3 && (
                  <div className="h-12 w-12 rounded-md border border-border bg-muted/50 flex items-center justify-center text-xs text-muted-foreground font-medium">
                    +{mainItem.files.length - 3}
                  </div>
                )}
              </div>
            )}

            {/* View Button */}
            <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
              <Link to={`/orders/${order.order_id}`}>
                View Details
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Image Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] w-[95vw] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="truncate text-sm sm:text-base font-semibold">
                {selectedFile?.file_name || selectedFile?.url.split('/').pop() || 'Image Preview'}
              </span>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!selectedFile) return;
                    try {
                      const fileName = selectedFile.file_name || selectedFile.url.split('/').pop() || 'image';
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
                {/* Show delete button only if user is uploader, admin, or sales */}
                {selectedFile && (
                  (selectedFile.uploaded_by === user?.uid || isAdmin || role === 'sales') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  )
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-6 min-h-0">
            {handleImagePreview()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? The file will be removed from the order but will remain in the history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!selectedFile) return;
                try {
                  const fileName = selectedFile.file_name || selectedFile.url.split('/').pop() || 'File';
                  
                  // Delete the file from Supabase
                  const { error: deleteError } = await supabase
                    .from('order_files')
                    .delete()
                    .eq('id', selectedFile.file_id);
                  
                  if (deleteError) throw deleteError;
                  
                  // Add timeline entry for file deletion (history preservation)
                  if (order.id && mainItem && user && profile) {
                    await addTimelineEntry({
                      order_id: order.id,
                      item_id: mainItem.item_id,
                      product_name: mainItem.product_name,
                      stage: mainItem.current_stage,
                      action: 'note_added',
                      performed_by: user.id,
                      performed_by_name: profile.full_name || 'Unknown',
                      notes: `File deleted: ${fileName}`,
                      attachments: [{ url: selectedFile.url, type: selectedFile.type }], // Keep file URL in history
                      is_public: true,
                    });
                  }
                  
                  toast({
                    title: "File deleted",
                    description: "The file has been removed successfully. It will remain in the history.",
                  });
                  
                  setPreviewOpen(false);
                  setSelectedFile(null);
                  setDeleteDialogOpen(false);
                  await refreshOrders();
                } catch (error: any) {
                  console.error('Error deleting file:', error);
                  toast({
                    title: "Error",
                    description: error.message || "Failed to delete file",
                    variant: "destructive",
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

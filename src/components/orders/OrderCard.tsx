import { useState, useEffect } from 'react';
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
import { getSupabaseSignedUrl } from '@/services/supabaseStorage';
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
  const [fileUrlCache, setFileUrlCache] = useState<Map<string, string>>(new Map());
  const { user, isAdmin, role, profile } = useAuth();
  const { refreshOrders, addTimelineEntry } = useOrders();

  // Helper to get file URL - use public URL directly since bucket is public
  const getFileUrl = async (file: OrderFile): Promise<string> => {
    let url = file.url || '';
    
    // If URL is a Supabase storage URL, decode it properly
    if (url && url.includes('supabase.co/storage')) {
      try {
        // Extract bucket and path from URL
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign\/[^/]+)\/([^/]+)\/(.+)/);
        
        if (pathMatch) {
          const bucket = pathMatch[1];
          let filePath = decodeURIComponent(pathMatch[2]); // Decode path
          
          // Check cache first
          if (fileUrlCache.has(filePath)) {
            return fileUrlCache.get(filePath)!;
          }
          
          // For public buckets, use public URL directly (no signed URL needed)
          // Only get signed URL if the URL contains 'sign' (indicating private bucket)
          if (urlObj.pathname.includes('/sign/')) {
            // Private bucket - get signed URL
            const signedUrl = await getSupabaseSignedUrl(filePath, bucket);
            setFileUrlCache(prev => new Map(prev).set(filePath, signedUrl));
            return signedUrl;
          } else {
            // Public bucket - use public URL directly (ensure it's properly encoded)
            const publicUrl = urlObj.origin + '/storage/v1/object/public/' + bucket + '/' + encodeURI(filePath).replace(/%2F/g, '/');
            setFileUrlCache(prev => new Map(prev).set(filePath, publicUrl));
            return publicUrl;
          }
        }
      } catch (e) {
        console.warn('Failed to process URL, using original:', url, e);
      }
    }
    
    return url;
  };

  // Synchronous version for immediate use (returns cached URL or original)
  const getFileUrlSync = (file: OrderFile): string => {
    let url = file.url || '';
    
    // If URL is a Supabase storage URL, check cache
    if (url && url.includes('supabase.co/storage')) {
      try {
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign\/[^/]+)\/([^/]+)\/(.+)/);
        
        if (pathMatch) {
          const filePath = decodeURIComponent(pathMatch[2]); // Decode path for cache lookup
          if (fileUrlCache.has(filePath)) {
            return fileUrlCache.get(filePath)!;
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    return url;
  };

  // Preload file URLs for thumbnails (only for Supabase storage URLs)
  useEffect(() => {
    if (mainItem?.files && mainItem.files.length > 0) {
      const filesToLoad = mainItem.files.slice(0, 3);
      filesToLoad.forEach(async (file) => {
        if (file.url?.includes('supabase.co/storage') && isImageFile(file)) {
          const cachedUrl = getFileUrlSync(file);
          // If URL is same as original, it's not cached yet, load it
          if (cachedUrl === file.url) {
            await getFileUrl(file);
          }
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainItem?.files?.length]);

  const isImageFile = (file: OrderFile) => {
    if (file.type === 'image') return true;
    const url = file.url || '';
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
  };

  const handleImageClick = (file: OrderFile, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isImageFile(file)) {
      setSelectedFile(file);
      setPreviewOpen(true);
    }
  };

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Load preview URL when file is selected
  useEffect(() => {
    if (selectedFile && previewOpen) {
      getFileUrl(selectedFile).then(setPreviewImageUrl).catch(() => {
        setPreviewImageUrl(selectedFile.url || null);
      });
    } else {
      setPreviewImageUrl(null);
    }
  }, [selectedFile, previewOpen]);

  const handleImagePreview = () => {
    if (!selectedFile || !previewImageUrl) return null;
    const fileName = selectedFile.file_name || selectedFile.url.split('/').pop() || 'Image';
    
    return (
      <div className="flex items-center justify-center w-full h-[calc(95vh-180px)] min-h-[400px] overflow-auto bg-muted/30 rounded-lg p-4">
        <img
          src={previewImageUrl}
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
    const [thumbnailUrl, setThumbnailUrl] = useState<string>(getFileUrlSync(file));
    const [hoverUrl, setHoverUrl] = useState<string | null>(null);

    // Load thumbnail URL if not cached (only once per file URL)
    useEffect(() => {
      if (isImage && file.url?.includes('supabase.co/storage')) {
        const cachedUrl = getFileUrlSync(file);
        // If not cached yet (URL same as original), load it
        if (cachedUrl === file.url) {
          getFileUrl(file).then(setThumbnailUrl).catch(() => {
            setThumbnailUrl(file.url || '');
          });
        } else {
          // Already cached, use cached URL
          setThumbnailUrl(cachedUrl);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file.url, isImage]);

    // Load hover preview URL when hovering
    const handleHover = () => {
      if (isImage && !hoverUrl) {
        getFileUrl(file).then(setHoverUrl).catch(() => {
          setHoverUrl(file.url || null);
        });
      }
    };

    const thumbnailContent = (
      <div
        className={cn(
          "relative h-12 w-12 rounded-md overflow-hidden border border-border bg-muted/50 flex-shrink-0 cursor-pointer group transition-all hover:scale-105 hover:border-primary/50",
          isImage && "hover:shadow-md"
        )}
        onClick={(e) => handleImageClick(file, e)}
        onMouseEnter={handleHover}
      >
        {isImage ? (
          <>
            <img
              src={thumbnailUrl}
              alt={fileName}
              className="h-full w-full object-cover transition-transform group-hover:scale-110"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent && !parent.querySelector('.thumbnail-fallback')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'thumbnail-fallback h-full w-full flex items-center justify-center';
                  fallback.innerHTML = '<svg class="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                  parent.appendChild(fallback);
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
                src={hoverUrl || thumbnailUrl}
                alt={fileName}
                className="w-full h-auto max-h-[500px] object-contain rounded-md"
                style={{ maxWidth: '100%', objectFit: 'contain' }}
                loading="lazy"
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
                      const url = previewImageUrl || await getFileUrl(selectedFile);
                      const link = document.createElement('a');
                      link.href = url;
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
                  onClick={async () => {
                    if (!selectedFile) return;
                    const url = previewImageUrl || await getFileUrl(selectedFile);
                    window.open(url, '_blank');
                  }}
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

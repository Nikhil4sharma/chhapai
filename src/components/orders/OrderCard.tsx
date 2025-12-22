import { useState, useEffect, useRef } from 'react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { HoverPreview } from '@/components/ui/hover-preview';
import { PreviewModal } from '@/components/ui/preview-modal';
import { useHoverCapability } from '@/hooks/useHoverCapability';
import { useHoverPreviewPosition } from '@/hooks/useHoverPreviewPosition';

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

  // Helper to get file URL - properly handle Supabase storage URLs
  const getFileUrl = async (file: OrderFile): Promise<string> => {
    let url = file.url || '';
    
    // If URL is a Supabase storage URL, get proper signed/public URL
    if (url && url.includes('supabase.co/storage')) {
      try {
        // Extract bucket and path from URL - handle multiple patterns
        const urlObj = new URL(url);
        // Match patterns like:
        // /storage/v1/object/public/bucket/path/to/file.jpg
        // /storage/v1/object/sign/bucket/token/path/to/file.jpg
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign\/[^/]+)\/([^/]+)\/(.+)/);
        
        if (pathMatch) {
          const bucket = pathMatch[1];
          let filePath = decodeURIComponent(pathMatch[2]); // Decode path
          
          // Check cache first
          if (fileUrlCache.has(filePath)) {
            const cachedUrl = fileUrlCache.get(filePath)!;
            // Verify cached URL is still valid (not expired for signed URLs)
            if (cachedUrl && !cachedUrl.includes('expires=')) {
              return cachedUrl;
            }
          }
          
          // Always try to get signed URL first (works for both public and private buckets)
          try {
            const signedUrl = await getSupabaseSignedUrl(filePath, bucket);
            if (signedUrl) {
              setFileUrlCache(prev => new Map(prev).set(filePath, signedUrl));
              return signedUrl;
            }
          } catch (signedError) {
            console.warn('Failed to get signed URL, trying public URL:', signedError);
          }
          
          // Fallback: Try public URL directly
          const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
          if (publicData?.publicUrl) {
            setFileUrlCache(prev => new Map(prev).set(filePath, publicData.publicUrl));
            return publicData.publicUrl;
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
      setPreviewImageUrl(null); // Reset to show loading
      getFileUrl(selectedFile)
        .then((url) => {
          setPreviewImageUrl(url);
        })
        .catch((err) => {
          console.error('Failed to load preview URL:', err);
          // Fallback to original URL
          setPreviewImageUrl(selectedFile.url || null);
        });
    } else {
      setPreviewImageUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.file_id, previewOpen]);

  const handleImagePreview = () => {
    if (!selectedFile) return null;
    const fileName = selectedFile.file_name || selectedFile.url.split('/').pop() || 'Image';
    
    if (!previewImageUrl) {
      // Loading state
      return (
        <div className="flex items-center justify-center w-full h-[calc(95vh-180px)] min-h-[400px]">
          <div className="flex flex-col items-center justify-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-muted-foreground">Loading image...</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-center w-full h-[calc(95vh-180px)] min-h-[400px] overflow-auto bg-muted/30 rounded-lg p-4">
        <img
          src={previewImageUrl}
          alt={fileName}
          className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
          onError={(e) => {
            console.error('Preview image failed to load:', previewImageUrl);
            const target = e.currentTarget;
            const parent = target.parentElement;
            if (parent && !parent.querySelector('.preview-fallback')) {
              target.style.display = 'none';
              const fallback = document.createElement('div');
              fallback.className = 'preview-fallback flex flex-col items-center justify-center py-12 text-center';
              const link = document.createElement('a');
              link.href = previewImageUrl;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.className = 'px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 inline-block mt-4';
              link.textContent = 'Open File in New Tab';
              fallback.innerHTML = `
                <svg class="h-16 w-16 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <p class="text-muted-foreground mb-4">Image preview not available</p>
              `;
              fallback.appendChild(link);
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
    const [imageError, setImageError] = useState(false);
    const thumbnailRef = useRef<HTMLDivElement>(null);
    const canHover = useHoverCapability();
    const hoverPosition = useHoverPreviewPosition(thumbnailRef, {
      enabled: canHover && isImage && !imageError && !!thumbnailUrl,
      previewWidth: 240,
      previewHeight: 320,
    });

    // Load thumbnail URL if not cached (only once per file URL)
    useEffect(() => {
      setImageError(false);
      if (isImage && file.url) {
        const cachedUrl = getFileUrlSync(file);
        // If not cached yet (URL same as original), load it
        if (cachedUrl === file.url || !cachedUrl) {
          getFileUrl(file)
            .then((url) => {
              setThumbnailUrl(url);
            })
            .catch((err) => {
              console.warn('Failed to load thumbnail URL:', err);
              setThumbnailUrl(file.url || '');
              setImageError(true);
            });
        } else {
          // Already cached, use cached URL
          setThumbnailUrl(cachedUrl);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file.url, file.file_id, isImage]);

    const thumbnailContent = (
      <div
        ref={thumbnailRef}
        className={cn(
          "relative h-12 w-12 rounded-md overflow-hidden border border-border bg-muted/50 flex-shrink-0 cursor-pointer group transition-all hover:scale-105 hover:border-primary/50",
          isImage && "hover:shadow-md"
        )}
        onClick={(e) => handleImageClick(file, e)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleImageClick(file, e as any);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Preview ${fileName}`}
      >
        {isImage ? (
          <>
            {!imageError && thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={fileName}
                className="h-full w-full object-cover transition-transform group-hover:scale-110"
                loading="lazy"
                onError={(e) => {
                  console.error('Thumbnail image failed to load:', thumbnailUrl);
                  setImageError(true);
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-muted/50">
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center pointer-events-none">
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

    return (
      <>
        {thumbnailContent}
        {/* Hover Preview - Desktop Only */}
        {isImage && canHover && hoverPosition && !imageError && thumbnailUrl && (
          <HoverPreview position={hoverPosition} maxWidth={240} maxHeight={320}>
            <div className="p-2">
              <img
                src={thumbnailUrl}
                alt={fileName}
                className="w-full h-auto max-h-[300px] object-contain rounded-md"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <p className="text-xs text-muted-foreground text-center mt-2 truncate px-1">
                {fileName}
              </p>
            </div>
          </HoverPreview>
        )}
      </>
    );
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

      {/* Image Preview Modal */}
      <PreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={selectedFile?.file_name || selectedFile?.url.split('/').pop() || 'Image Preview'}
        onDownload={async () => {
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
        onOpen={async () => {
          if (!selectedFile) return;
          const url = previewImageUrl || await getFileUrl(selectedFile);
          window.open(url, '_blank');
        }}
        onDelete={() => setDeleteDialogOpen(true)}
        showDelete={
          selectedFile
            ? selectedFile.uploaded_by === user?.uid || isAdmin || role === 'sales'
            : false
        }
      >
        {handleImagePreview()}
      </PreviewModal>

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

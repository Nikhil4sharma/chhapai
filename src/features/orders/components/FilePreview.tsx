import { useState, useEffect, useRef } from 'react';
import { FileText, Eye, ExternalLink, FileImage, Trash2, Download, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { OrderFile } from '@/types/order';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getSupabaseSignedUrl } from '@/services/supabaseStorage';
import { PreviewContent } from './PreviewContent';
import { HoverPreview } from '@/components/ui/hover-preview';
import { PreviewModal } from '@/components/ui/preview-modal';
import { useHoverCapability } from '@/hooks/useHoverCapability';
import { useHoverPreviewPosition } from '@/hooks/useHoverPreviewPosition';

interface FilePreviewProps {
  files: OrderFile[];
  compact?: boolean;
  onFileDeleted?: () => void;
  canDelete?: boolean;
  orderId?: string;
  itemId?: string;
  productName?: string;
  department?: string;
  uploadedByName?: (userId: string) => string | undefined;
}

export function FilePreview({ files, compact = false, onFileDeleted, canDelete = true, orderId, itemId, productName, department, uploadedByName }: FilePreviewProps) {
  const { user, isAdmin, role, profile } = useAuth();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<OrderFile | null>(null);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fileUrlCache, setFileUrlCache] = useState<Map<string, string>>(new Map());
  const [cacheVersion, setCacheVersion] = useState(0); // Track cache updates to trigger re-renders
  
  // Check if user can delete a specific file
  const canDeleteFile = (file: OrderFile) => {
    if (!canDelete) return false;
    // Uploader, admin, or sales can delete
    return file.uploaded_by === user?.id || isAdmin || role === 'sales';
  };

  if (!files || files.length === 0) return null;
  
  // Helper functions (defined before useEffect)
  const getFileName = (file: OrderFile) => {
    if (file.file_name) return file.file_name;
    const url = file.url || '';
    const urlParts = url.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    // Remove query parameters
    const fileName = lastPart.split('?')[0];
    return fileName || 'File';
  };

  const isImage = (fileName: string | undefined, fileUrl?: string, fileType?: string) => {
    // Check file type first (from database)
    if (fileType === 'image') return true;
    
    if (!fileName && !fileUrl) return false;
    const name = fileName || fileUrl || '';
    // Check by extension
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name)) return true;
    
    // Check by MIME type in URL (if present)
    if (fileUrl && /image\//i.test(fileUrl)) return true;
    
    return false;
  };
  
  // Pre-load signed URLs for all images when files change
  useEffect(() => {
    let isMounted = true;
    
    const loadSignedUrls = async () => {
      const pathsToLoad: Array<{ path: string; bucket: string }> = [];
      
      // Collect all image paths that need signed URLs
      for (const file of files) {
        const fileName = getFileName(file);
        const fileUrl = file.url || '';
        
        // Only pre-load for images
        if (isImage(fileName, fileUrl, file.type) && fileUrl.includes('supabase.co/storage')) {
          try {
            const urlObj = new URL(fileUrl);
            const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign\/[^/]+)\/([^/]+)\/(.+)/);
            
            if (pathMatch) {
              const filePath = decodeURIComponent(pathMatch[2]);
              pathsToLoad.push({ path: filePath, bucket: pathMatch[1] });
            }
          } catch (e) {
            console.warn('Failed to parse URL for file:', fileUrl, e);
          }
        }
      }
      
      // Load signed URLs for all collected paths
      const newCache = new Map(fileUrlCache);
      for (const { path, bucket } of pathsToLoad) {
        // Skip if already in cache
        if (newCache.has(path)) continue;
        
        try {
          const signedUrl = await getSupabaseSignedUrl(path, bucket);
          if (signedUrl && isMounted) {
            newCache.set(path, signedUrl);
          }
        } catch (e) {
          console.warn('Failed to pre-load signed URL for path:', path, e);
        }
      }
      
      // Update cache once with all new URLs
      if (isMounted && newCache.size > fileUrlCache.size) {
        setFileUrlCache(newCache);
        setCacheVersion(prev => prev + 1); // Trigger re-renders in child components
      }
    };
    
    if (files.length > 0) {
      loadSignedUrls();
    }
    
    return () => {
      isMounted = false;
    };
  }, [files]); // CRITICAL: Only depend on files

  // Helper to get file URL - use signed URL for private buckets
  const getFileUrl = async (file: OrderFile): Promise<string> => {
    let url = file.url || '';
    
    // If URL is a Supabase storage URL, try to get signed URL
    if (url && url.includes('supabase.co/storage')) {
      try {
        // Extract bucket and path from URL - handle both public and signed URLs
        const urlObj = new URL(url);
        // Match patterns like:
        // /storage/v1/object/public/order-files/path/to/file.jpg
        // /storage/v1/object/sign/order-files/path/to/file.jpg
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign\/[^/]+)\/([^/]+)\/(.+)/);
        
        if (pathMatch) {
          const bucket = pathMatch[1];
          const filePath = decodeURIComponent(pathMatch[2]); // Decode URL-encoded path
          
          // Check cache first
          if (fileUrlCache.has(filePath)) {
            return fileUrlCache.get(filePath)!;
          }
          
          // Get signed URL for private bucket
          const signedUrl = await getSupabaseSignedUrl(filePath, bucket);
          
          // Cache the URL
          if (signedUrl) {
            setFileUrlCache(prev => new Map(prev).set(filePath, signedUrl));
            setCacheVersion(prev => prev + 1); // Trigger re-renders in child components
            return signedUrl;
          }
        }
      } catch (e) {
        console.warn('Failed to get signed URL, using original:', url, e);
      }
    }
    
    return url;
  };

  // Synchronous version for immediate use (returns cached URL or original)
  // Also triggers async signed URL fetch for images
  const getFileUrlSync = (file: OrderFile): string => {
    let url = file.url || '';
    
    // If URL is a Supabase storage URL, check cache
    if (url && url.includes('supabase.co/storage')) {
      try {
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign\/[^/]+)\/([^/]+)\/(.+)/);
        
        if (pathMatch) {
          const filePath = decodeURIComponent(pathMatch[2]);
          if (fileUrlCache.has(filePath)) {
            return fileUrlCache.get(filePath)!;
          }
          
          // For images, trigger async fetch to get signed URL
          // This will update the cache and re-render when ready
          if (isImage(getFileName(file), url, file.type)) {
            getFileUrl(file).catch(err => {
              console.warn('Failed to fetch signed URL for image:', err);
            });
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    return url;
  };

  const isPdf = (fileName: string | undefined, fileUrl?: string, fileType?: string) => {
    // Check file type first (from database)
    if (fileType === 'proof' || fileType === 'final') {
      // Proof and final files are usually PDFs, but check extension too
      if (fileName && /\.pdf$/i.test(fileName)) return true;
    }
    
    if (!fileName && !fileUrl) return false;
    const name = fileName || fileUrl || '';
    return /\.pdf$/i.test(name);
  };

  const handlePreview = (file: OrderFile) => {
    setSelectedFile(file);
    setPreviewOpen(true);
  };

  const handleDeleteFile = async () => {
    if (!deleteFileId || !selectedFile) return;
    
    setIsDeleting(true);
    try {
      const fileName = getFileName(selectedFile);
      
      // Delete the file from Supabase
      const { error: deleteError } = await supabase
        .from('order_files')
        .delete()
        .eq('id', deleteFileId);
      
      if (deleteError) throw deleteError;

      // Add timeline entry for file deletion (history preservation)
      if (orderId && user && profile) {
        // Find order to get order.id
        const { data: orderData } = await supabase
          .from('orders')
          .select('id')
          .eq('order_id', orderId)
          .single();
        
        if (orderData) {
          await supabase
            .from('timeline')
            .insert({
              order_id: orderData.id,
              item_id: itemId || null,
              product_name: productName || null,
              stage: 'sales', // Default stage for file deletion
              action: 'note_added',
              performed_by: user.id,
              performed_by_name: profile.full_name || 'Unknown',
              notes: `File deleted: ${fileName}`,
              attachments: [{ url: selectedFile.url, type: selectedFile.type }], // Keep file URL in history
              is_public: true,
            });
        }
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
    
    return (
      <PreviewContent
        file={selectedFile}
        getFileName={getFileName}
        getFileUrlSync={getFileUrlSync}
        getFileUrl={getFileUrl}
        isPdf={isPdf}
        isImage={isImage}
      />
    );
  };

  const FileButton = ({ file }: { file: OrderFile }) => {
    const fileName = getFileName(file);
    const fileUrl = getFileUrlSync(file);
    const fileIsImage = isImage(fileName, fileUrl, file.type);
    const fileIsPdf = isPdf(fileName, fileUrl, file.type);
    const [imageSrc, setImageSrc] = useState<string>('');
    const [imageError, setImageError] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const canHover = useHoverCapability();
    const hoverPosition = useHoverPreviewPosition(buttonRef, {
      enabled: canHover && fileIsImage && !imageError && !!imageSrc,
      previewWidth: 260,
      previewHeight: 340,
    });
    
    // For images, check if we have a signed URL before setting src
    useEffect(() => {
      if (fileIsImage && file.url) {
        // Reset error state
        setImageError(false);
        
        // Check if URL is Supabase storage URL
        if (file.url.includes('supabase.co/storage')) {
          try {
            const urlObj = new URL(file.url);
            const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign\/[^/]+)\/([^/]+)\/(.+)/);
            
            if (pathMatch) {
              const filePath = decodeURIComponent(pathMatch[2]);
              // If we have signed URL in cache, use it
              // eslint-disable-next-line react-hooks/exhaustive-deps
              if (fileUrlCache.has(filePath)) {
                // eslint-disable-next-line react-hooks/exhaustive-deps
                setImageSrc(fileUrlCache.get(filePath)!);
              } else {
                // Fetch signed URL and update
                getFileUrl(file).then(url => {
                  if (url) setImageSrc(url);
                }).catch(() => {
                  setImageError(true);
                });
              }
            } else {
              setImageSrc(fileUrl);
            }
          } catch {
            setImageSrc(fileUrl);
          }
        } else {
          setImageSrc(fileUrl);
        }
      } else if (fileIsImage) {
        setImageSrc(fileUrl);
      }
    }, [file.file_id, file.url, fileIsImage, fileUrl, cacheVersion]); // Include cacheVersion to re-check when cache updates

    const buttonContent = (
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className="h-auto p-1.5 hover:bg-accent/50 transition-colors"
        onClick={() => handlePreview(file)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handlePreview(file);
          }
        }}
        aria-label={`Preview ${fileName}`}
      >
        {fileIsImage || fileIsPdf ? (
          <div className="relative h-16 w-20 rounded-md overflow-hidden border border-border group flex-shrink-0 bg-muted/50">
            {fileIsPdf ? (
              // PDF thumbnail - show PDF icon
              <div className="h-full w-full flex items-center justify-center bg-red-500/10">
                <FileText className="h-8 w-8 text-red-500" />
                <div className="absolute top-1 right-1 bg-red-500 text-white text-[8px] px-1 rounded font-semibold">
                  PDF
                </div>
              </div>
            ) : (
              // Image thumbnail
              imageError || !imageSrc ? (
                // Loading or error state
                <div className="h-full w-full flex items-center justify-center bg-muted">
                  {imageError ? (
                    <FileImage className="h-6 w-6 text-muted-foreground" />
                  ) : (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  )}
                </div>
              ) : (
                <div className="h-full w-full relative">
                  <img 
                    src={imageSrc || fileUrl} 
                    alt={fileName}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      // Try to fetch signed URL if error occurs
                      if (file.url && file.url.includes('supabase.co/storage') && !imageError) {
                        getFileUrl(file).then(url => {
                          if (url && url !== fileUrl) {
                            setImageSrc(url);
                          } else {
                            setImageError(true);
                          }
                        }).catch(() => {
                          setImageError(true);
                        });
                      } else {
                        setImageError(true);
                      }
                    }}
                  />
                  {file.uploaded_by && (
                    <div className="absolute top-1 left-1 right-1 flex items-center justify-end text-[9px] gap-1 text-white">
                      <span className="bg-black/60 px-1 py-0.5 rounded truncate">
                        {uploadedByName?.(file.uploaded_by) || file.uploaded_by}
                      </span>
                    </div>
                  )}
                </div>
              )
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2 py-1 bg-secondary rounded-md border border-border">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs max-w-[80px] truncate">{fileName}</span>
          </div>
        )}
      </Button>
    );

    return (
      <>
        {fileIsImage || fileIsPdf ? (
          <>
            {buttonContent}
            {/* Hover Preview - Desktop Only (Images) */}
            {fileIsImage && canHover && hoverPosition && !imageError && imageSrc && (
              <HoverPreview position={hoverPosition} maxWidth={260} maxHeight={340}>
                <div className="p-2 space-y-1">
                  <img
                    src={imageSrc || fileUrl}
                    alt={fileName}
                    className="w-full h-auto max-h-[320px] object-contain rounded-md"
                    loading="lazy"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <p className="text-xs text-muted-foreground text-center truncate px-1">
                    {fileName}
                  </p>
                  {(department || file.uploaded_by) && (
                    <p className="text-[10px] text-muted-foreground text-center truncate px-1">
                      {department ? `${department}` : ''}{department && file.uploaded_by ? ' • ' : ''}{file.uploaded_by ? (uploadedByName?.(file.uploaded_by) || file.uploaded_by) : ''}
                    </p>
                  )}
                </div>
              </HoverPreview>
            )}
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
            <TooltipContent>{fileName}</TooltipContent>
          </Tooltip>
        )}
      </>
    );
  };

  const PreviewDialog = () => (
    <>
      <PreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={selectedFile ? getFileName(selectedFile) : 'File Preview'}
        onDownload={async () => {
          if (!selectedFile) return;
          try {
            const fileName = getFileName(selectedFile);
            const fileUrl = await getFileUrl(selectedFile);
            const link = document.createElement('a');
            link.href = fileUrl;
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
          if (selectedFile) {
            try {
              const url = await getFileUrl(selectedFile);
              window.open(url, '_blank');
            } catch (error) {
              console.error('Error getting file URL:', error);
              window.open(selectedFile.url || '', '_blank');
            }
          }
        }}
        onDelete={() => selectedFile && setDeleteFileId(selectedFile.file_id)}
        showDelete={selectedFile ? canDeleteFile(selectedFile) : false}
      >
        {renderPreviewContent()}
      </PreviewModal>

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
    const maxThumbs = 3;
    const thumbFiles = files.slice(0, maxThumbs);
    const remaining = files.length - thumbFiles.length;

    return (
      <>
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {thumbFiles.map((file) => (
            <FileButton key={file.file_id} file={file} />
          ))}
          {remaining > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="xs"
                  className="h-7 px-2 text-[10px] rounded-full border-dashed"
                  onClick={(e) => e.stopPropagation()}
                >
                  +{remaining} more
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <FileImage className="h-4 w-4" />
                    All Files
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {files.map((file) => {
                    const name = getFileName(file);
                    return (
                      <div
                        key={file.file_id}
                        className="flex items-center justify-between gap-3 text-sm border-b border-border/40 pb-2 last:border-b-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileImage className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate">{name}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="xs"
                          className="text-[11px]"
                          onClick={async () => {
                            setSelectedFile(file);
                            setPreviewOpen(true);
                          }}
                        >
                          Preview
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <PreviewDialog />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar mt-2">
        {files.map((file) => (
          <FileButton key={file.file_id} file={file} />
        ))}
      </div>
      <PreviewDialog />
    </>
  );
}

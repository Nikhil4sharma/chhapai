import { useState, useMemo, useEffect } from 'react';
import { FileText, Eye, Download, Trash2, User, Clock, FileIcon, CheckCircle2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getSupabaseSignedUrl } from '@/services/supabaseStorage';
import { PreviewContent } from './PreviewContent';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface FileHistoryProps {
  files: OrderFile[];
  orderId: string;
  itemId: string;
  onFileDeleted?: () => void;
}

type FileRole = 'proof' | 'final' | 'image' | 'other';

interface FileGroup {
  role: FileRole;
  files: OrderFile[];
}

export function FileHistory({ files, orderId, itemId, onFileDeleted }: FileHistoryProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<OrderFile | null>(null);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userNamesMap, setUserNamesMap] = useState<Map<string, string>>(new Map());
  const [previousVersionsOpen, setPreviousVersionsOpen] = useState<Record<string, boolean>>({});
  const [fileUrlCache, setFileUrlCache] = useState<Map<string, string>>(new Map());

  // Fetch user names for uploaded_by fields
  useEffect(() => {
    const fetchUserNames = async () => {
      try {
        const userIds = [...new Set(files.map(f => f.uploaded_by).filter(Boolean))];
        if (userIds.length === 0) return;

        const { data: profilesData, error } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        if (error) {
          console.error('Error fetching user names:', error);
          return;
        }

        const namesMap = new Map<string, string>();
        (profilesData || []).forEach(profile => {
          if (profile.user_id) {
            namesMap.set(profile.user_id, profile.full_name || 'Unknown');
          }
        });

        setUserNamesMap(namesMap);
      } catch (error) {
        console.error('Error fetching user names:', error);
      }
    };

    fetchUserNames();
  }, [files]);

  // Group files by role
  const fileGroups = useMemo(() => {
    const groups: Record<FileRole, OrderFile[]> = {
      proof: [],
      final: [],
      image: [],
      other: [],
    };

    files.forEach(file => {
      const role = file.type || 'other';
      if (role in groups) {
        groups[role as FileRole].push(file);
      } else {
        groups.other.push(file);
      }
    });

    return Object.entries(groups)
      .filter(([_, files]) => files.length > 0)
      .map(([role, files]) => ({
        role: role as FileRole,
        files: files.sort((a, b) => 
          new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
        ),
      }));
  }, [files]);

  const getRoleLabel = (role: FileRole) => {
    const labels: Record<FileRole, string> = {
      proof: 'Proof',
      final: 'Final',
      image: 'Image',
      other: 'Other',
    };
    return labels[role];
  };

  const handlePreview = (file: OrderFile) => {
    setPreviewFile(file);
    setPreviewOpen(true);
  };

  // Helper to get signed URL for private bucket
  const getFileUrl = async (file: OrderFile): Promise<string> => {
    let url = file.url || '';
    
    // If URL is a Supabase storage URL, try to get signed URL
    if (url && url.includes('supabase.co/storage')) {
      try {
        // Extract bucket and path from URL
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign\/[^/]+)\/([^/]+)\/(.+)/);
        
        if (pathMatch) {
          const bucket = pathMatch[1];
          const filePath = pathMatch[2];
          
          // Check cache first
          if (fileUrlCache.has(filePath)) {
            return fileUrlCache.get(filePath)!;
          }
          
          // Get signed URL for private bucket
          const signedUrl = await getSupabaseSignedUrl(filePath, bucket);
          
          // Cache the URL
          setFileUrlCache(prev => new Map(prev).set(filePath, signedUrl));
          
          return signedUrl;
        }
      } catch (e) {
        console.warn('Failed to get signed URL, using original:', url, e);
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
          const filePath = pathMatch[2];
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

  // Pre-fetch signed URLs for all files
  useEffect(() => {
    const fetchSignedUrls = async () => {
      const newCache = new Map<string, string>();
      
      for (const file of files) {
        const url = file.url || '';
        if (url && url.includes('supabase.co/storage')) {
          try {
            const urlObj = new URL(url);
            const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign\/[^/]+)\/([^/]+)\/(.+)/);
            
            if (pathMatch) {
              const bucket = pathMatch[1];
              const filePath = pathMatch[2];
              
              // Skip if already cached
              if (fileUrlCache.has(filePath)) {
                newCache.set(filePath, fileUrlCache.get(filePath)!);
                continue;
              }
              
              // Get signed URL
              const signedUrl = await getSupabaseSignedUrl(filePath, bucket);
              newCache.set(filePath, signedUrl);
            }
          } catch (e) {
            console.warn('Failed to get signed URL for file:', file.url, e);
          }
        }
      }
      
      if (newCache.size > 0) {
        setFileUrlCache(prev => new Map([...prev, ...newCache]));
      }
    };
    
    fetchSignedUrls();
  }, [files]);

  const handleDownload = async (file: OrderFile) => {
    try {
      const fileName = file.file_name || `file-${file.file_id}`;
      
      // Get signed URL for private bucket
      const fileUrl = await getFileUrl(file);
      
      // For Supabase Storage URLs, fetch the file and create a blob for proper download
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download Started",
        description: `Downloading ${fileName}...`,
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteFileId) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('order_files')
        .delete()
        .eq('id', deleteFileId);
      
      if (error) throw error;
      
      toast({
        title: "File Deleted",
        description: "File has been removed successfully",
      });
      
      setDeleteFileId(null);
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
    }
  };

  const isImage = (url: string, fileName?: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url) || 
           /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName || '');
  };

  const isPdf = (url: string, fileName?: string) => {
    return /\.pdf$/i.test(url) || /\.pdf$/i.test(fileName || '');
  };

  const getFileName = (file: OrderFile) => {
    return file.file_name || file.url.split('/').pop() || 'File';
  };

  const renderPreviewContent = () => {
    if (!previewFile) return null;
    
    return (
      <PreviewContent
        file={previewFile}
        getFileName={getFileName}
        getFileUrlSync={getFileUrlSync}
        getFileUrl={getFileUrl}
        isPdf={isPdf}
        isImage={isImage}
      />
    );
  };

  if (fileGroups.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No files uploaded yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {fileGroups.map((group) => {
          const latestFile = group.files[0];
          const isActive = group.files.length > 0;

          return (
            <Card key={group.role} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {getRoleLabel(group.role)}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {group.files.length} version{group.files.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {isActive && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Latest/Active File */}
                {latestFile && (
                  <div className="border-2 border-green-500/30 rounded-lg p-4 bg-green-500/5 mb-3">
                    <div className="flex items-start gap-4">
                      {/* Thumbnail */}
                      <div className="relative h-16 w-16 rounded-md overflow-hidden border border-border bg-muted/50 flex-shrink-0">
                        {isImage(latestFile.url, latestFile.file_name) ? (
                          <img
                            src={getFileUrlSync(latestFile)}
                            alt={latestFile.file_name || 'Preview'}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <FileIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* File Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                            Current
                          </Badge>
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                            Active
                          </Badge>
                        </div>
                        
                        <h4 className="font-medium text-sm mb-2 truncate">
                          {latestFile.file_name || 'File'}
                        </h4>

                        <div className="space-y-1.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            <span className="truncate">
                              {userNamesMap.get(latestFile.uploaded_by) || latestFile.uploaded_by || 'Unknown'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>{format(new Date(latestFile.uploaded_at), 'MMM d, yyyy HH:mm')}</span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 sm:gap-2 mt-3 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreview(latestFile)}
                            className="h-8 text-xs flex-1 sm:flex-initial min-w-[calc(33.333%-0.5rem)] sm:min-w-0"
                          >
                            <Eye className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="truncate">Preview</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(latestFile)}
                            className="h-8 text-xs flex-1 sm:flex-initial min-w-[calc(33.333%-0.5rem)] sm:min-w-0"
                          >
                            <Download className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="truncate">Download</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteFileId(latestFile.file_id)}
                            className="h-8 text-xs text-destructive hover:text-destructive flex-1 sm:flex-initial min-w-[calc(33.333%-0.5rem)] sm:min-w-0"
                          >
                            <Trash2 className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="truncate">Delete</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Previous Versions - Collapsible */}
                {group.files.length > 1 && (
                  <Collapsible 
                    open={previousVersionsOpen[group.role] || false}
                    onOpenChange={(open) => setPreviousVersionsOpen(prev => ({ ...prev, [group.role]: open }))}
                  >
                    <div className="border-t pt-3 mt-3">
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center justify-between w-full text-left hover:bg-muted/50 rounded-md p-2 -mx-2 transition-colors">
                          <p className="text-xs text-muted-foreground font-medium">
                            Previous Versions ({group.files.length - 1})
                          </p>
                          {previousVersionsOpen[group.role] ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <ScrollArea className="max-h-48 mt-2">
                          <div className="space-y-2 pr-2">
                            {group.files.slice(1).map((file) => (
                              <div
                                key={file.file_id}
                                className="flex items-center gap-3 p-2 rounded-md border border-border hover:bg-muted/50 transition-colors"
                              >
                                <div className="relative h-10 w-10 rounded overflow-hidden border border-border bg-muted/50 flex-shrink-0">
                                  {isImage(file.url, file.file_name) ? (
                                    <img
                                      src={getFileUrlSync(file)}
                                      alt={file.file_name || 'Preview'}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center">
                                      <FileIcon className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">
                                    {file.file_name || 'File'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(file.uploaded_at), 'MMM d, yyyy HH:mm')}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handlePreview(file)}
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleDownload(file)}
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setDeleteFileId(file.file_id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] w-[95vw] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-base sm:text-lg font-display truncate flex-1 min-w-0">
                {previewFile?.file_name || 'File Preview'}
              </DialogTitle>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                {previewFile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(previewFile)}
                    className="h-8 sm:h-9 text-xs sm:text-sm"
                  >
                    <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    <span className="hidden xs:inline">Download</span>
                    <span className="xs:hidden">DL</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewOpen(false)}
                  className="h-8 w-8 sm:h-9 sm:w-9"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-6">
            {renderPreviewContent()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
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
              onClick={handleDelete}
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
}


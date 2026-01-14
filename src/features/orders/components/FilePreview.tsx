import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { FileText, Eye, ExternalLink, FileImage, Trash2, Download, X, Loader2, User, Building2, History, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
import { format } from 'date-fns';

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

// Map Department to Colors
const DEPT_COLORS: Record<string, string> = {
  'sales': 'bg-blue-100 text-blue-800 border-blue-200',
  'design': 'bg-purple-100 text-purple-800 border-purple-200',
  'prepress': 'bg-pink-100 text-pink-800 border-pink-200',
  'production': 'bg-orange-100 text-orange-800 border-orange-200',
  'admin': 'bg-gray-100 text-gray-800 border-gray-200',
};

interface UploaderProfile {
  user_id: string;
  full_name: string;
  department: string;
  avatar_url?: string;
}

// Extracted FileButton component
interface FileButtonProps {
  file: OrderFile;
  getFileName: (file: OrderFile) => string;
  getFileUrlSync: (file: OrderFile) => string;
  getFileUrl: (file: OrderFile) => Promise<string>;
  isImage: (fileName: string | undefined, fileUrl?: string, fileType?: string) => boolean;
  isPdf: (fileName: string | undefined, fileUrl?: string, fileType?: string) => boolean;
  handlePreview: (file: OrderFile) => void;
  uploaderProfile?: UploaderProfile;
  fileUrlCache: Map<string, string>;
  cacheVersion: number;
}

const FileButton = memo(({
  file,
  getFileName,
  getFileUrlSync,
  getFileUrl,
  isImage,
  isPdf,
  handlePreview,
  uploaderProfile,
  fileUrlCache,
  cacheVersion
}: FileButtonProps) => {
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

  // Department Styling
  const deptStyle = DEPT_COLORS[uploaderProfile?.department?.toLowerCase() || 'admin'] || DEPT_COLORS['admin'];

  // For images, check if we have a signed URL before setting src
  useEffect(() => {
    let isMounted = true;
    if (fileIsImage && file.url) {
      if (isMounted) setImageError(false);
      if (file.url.includes('supabase.co/storage')) {
        try {
          const urlObj = new URL(file.url);
          const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign\/[^/]+)\/([^/]+)\/(.+)/);
          if (pathMatch) {
            const filePath = decodeURIComponent(pathMatch[2]);
            if (fileUrlCache.has(filePath)) {
              if (isMounted) setImageSrc(fileUrlCache.get(filePath)!);
            } else {
              getFileUrl(file).then(url => { if (isMounted && url) setImageSrc(url); }).catch(() => { if (isMounted) setImageError(true); });
            }
          } else {
            if (isMounted) setImageSrc(fileUrl);
          }
        } catch { if (isMounted) setImageSrc(fileUrl); }
      } else {
        if (isMounted) setImageSrc(fileUrl);
      }
    } else if (fileIsImage) {
      if (isMounted) setImageSrc(fileUrl);
    }
    return () => { isMounted = false; };
  }, [file.file_id, file.url, fileIsImage, fileUrl, cacheVersion]);

  const buttonContent = (
    <Button
      ref={buttonRef}
      variant="ghost"
      size="sm"
      className="h-auto p-0 hover:scale-105 transition-all duration-200"
      onClick={(e) => { e.stopPropagation(); handlePreview(file); }}
    >
      {fileIsImage || fileIsPdf ? (
        <div className={`relative h-20 w-24 rounded-lg overflow-hidden border-2 group flex-shrink-0 bg-muted/50 ${deptStyle.split(' ')[2]}`}>
          {fileIsPdf ? (
            <div className="h-full w-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
              <FileText className="h-8 w-8 text-red-500" />
              <div className="absolute top-1 right-1 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold shadow-sm">PDF</div>
            </div>
          ) : (
            imageError || !imageSrc ? (
              <div className="h-full w-full flex items-center justify-center bg-muted">
                {imageError ? <FileImage className="h-6 w-6 text-muted-foreground" /> : <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />}
              </div>
            ) : (
              <div className="h-full w-full relative">
                <img
                  src={imageSrc || fileUrl}
                  alt={fileName}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  crossOrigin="anonymous"
                  onError={() => setImageError(true)}
                />
              </div>
            )
          )}

          {/* Uploader Info Badge */}
          {uploaderProfile && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-[1px] text-white text-[9px] px-1.5 py-1.5 flex items-center justify-between">
              <span className="truncate max-w-[60px]">{uploaderProfile.full_name.split(' ')[0]}</span>
              <Badge variant="outline" className={`h-3.5 px-1 text-[8px] border-none bg-white/20 text-white uppercase`}>
                {uploaderProfile.department?.substring(0, 3) || '???'}
              </Badge>
            </div>
          )}

          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-all transform scale-50 group-hover:scale-100 duration-200 drop-shadow-md" />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg border border-border">
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
          {fileIsImage && canHover && hoverPosition && !imageError && imageSrc && (
            <HoverPreview position={hoverPosition} maxWidth={280} maxHeight={360}>
              <div className="p-2 space-y-2 bg-background/95 backdrop-blur-sm">
                <img src={imageSrc || fileUrl} alt={fileName} className="w-full h-auto max-h-[300px] object-contain rounded-md shadow-sm" crossOrigin="anonymous" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground truncate px-1">{fileName}</p>
                  {uploaderProfile && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
                      <UserCircleIcon name={uploaderProfile.full_name} className="h-3 w-3" />
                      <span>{uploaderProfile.full_name}</span>
                      <span className="text-muted-foreground/50">•</span>
                      <span className="uppercase font-semibold tracking-wider">{uploaderProfile.department}</span>
                    </div>
                  )}
                  <p className="text-[9px] text-muted-foreground px-1">{format(new Date(file.uploaded_at), 'MMM d, h:mm a')}</p>
                </div>
              </div>
            </HoverPreview>
          )}
        </>
      ) : (
        <Tooltip><TooltipTrigger asChild>{buttonContent}</TooltipTrigger><TooltipContent>{fileName}</TooltipContent></Tooltip>
      )}
    </>
  );
});

// Simple User Icon helper
const UserCircleIcon = ({ name, className }: { name: string, className?: string }) => (
  <div className={`rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold ${className}`}>
    {name.charAt(0).toUpperCase()}
  </div>
);

export function FilePreview({ files, compact = false, onFileDeleted, canDelete = true, orderId, itemId, productName, department }: FilePreviewProps) {
  const { user, isAdmin, role, profile } = useAuth();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<OrderFile | null>(null);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fileUrlCache, setFileUrlCache] = useState<Map<string, string>>(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);

  // Uploader Profiles State
  const [uploaderProfiles, setUploaderProfiles] = useState<Record<string, UploaderProfile>>({});

  // Fetch profiles for uploaders
  useEffect(() => {
    const fetchProfiles = async () => {
      const userIds = Array.from(new Set(files.map(f => f.uploaded_by).filter(Boolean)));
      if (userIds.length === 0) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, department, avatar_url')
        .in('user_id', userIds);

      if (!error && data) {
        const profilesMap: Record<string, UploaderProfile> = {};
        data.forEach((p: any) => {
          profilesMap[p.user_id] = p;
        });
        setUploaderProfiles(profilesMap);
      }
    };
    fetchProfiles();
  }, [files]);

  // Sort files: Latest first
  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  }, [files]);

  // Split logic: Show ONLY 1 latest, rest in history
  const MAX_VISIBLE = 1;
  const recentFiles = sortedFiles.slice(0, MAX_VISIBLE);
  const olderFiles = sortedFiles.slice(MAX_VISIBLE);

  // Group older files by Department -> User
  const groupedHistory = useMemo(() => {
    const groups: Record<string, Record<string, OrderFile[]>> = {};

    olderFiles.forEach(file => {
      const profile = uploaderProfiles[file.uploaded_by];
      const dept = profile?.department?.toLowerCase() || 'unknown';
      const userName = profile?.full_name || 'Unknown User';

      if (!groups[dept]) groups[dept] = {};
      if (!groups[dept][userName]) groups[dept][userName] = [];
      groups[dept][userName].push(file);
    });

    return groups;
  }, [olderFiles, uploaderProfiles]);


  const canDeleteFile = (file: OrderFile) => {
    if (!canDelete) return false;
    return file.uploaded_by === user?.id || isAdmin || role === 'sales';
  };

  if (!files || files.length === 0) return null;

  // -- Helper functions (getFileName, isImage, isPdf, handleDeleteFile, etc.) same as before --
  const getFileName = (file: OrderFile) => {
    if (file.file_name) return file.file_name;
    const url = file.url || '';
    return url.split('/').pop()?.split('?')[0] || 'File';
  };
  const isImage = (fileName: string | undefined, fileUrl?: string, fileType?: string) => {
    if (fileType === 'image') return true;
    const name = fileName || fileUrl || '';
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name) || (!!fileUrl && /image\//i.test(fileUrl));
  };
  const isPdf = (fileName: string | undefined, fileUrl?: string, fileType?: string) => {
    if (fileType === 'proof' || fileType === 'final') if (fileName && /\.pdf$/i.test(fileName)) return true;
    const name = fileName || fileUrl || '';
    return /\.pdf$/i.test(name);
  };

  // File URL Cache Logic (Same as original)
  useEffect(() => {
    let isMounted = true;
    const loadSignedUrls = async () => {
      const newCache = new Map(fileUrlCache);
      for (const file of files) {
        const fileName = getFileName(file);
        if (isImage(fileName, file.url, file.type) && file.url.includes('supabase.co/storage')) {
          try {
            const urlObj = new URL(file.url);
            const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign\/[^/]+)\/([^/]+)\/(.+)/);
            if (pathMatch) {
              const filePath = decodeURIComponent(pathMatch[2]);
              const bucket = pathMatch[1];
              if (!newCache.has(filePath)) {
                const signedUrl = await getSupabaseSignedUrl(filePath, bucket);
                if (signedUrl && isMounted) newCache.set(filePath, signedUrl);
              }
            }
          } catch { }
        }
      }
      if (isMounted && newCache.size > fileUrlCache.size) { setFileUrlCache(newCache); setCacheVersion(v => v + 1); }
    };
    if (files.length > 0) loadSignedUrls();
    return () => { isMounted = false; };
  }, [files]);

  const getFileUrl = async (file: OrderFile): Promise<string> => {
    let url = file.url || '';
    if (url && url.includes('supabase.co/storage')) {
      try {
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign\/[^/]+)\/([^/]+)\/(.+)/);
        if (pathMatch) {
          const filePath = decodeURIComponent(pathMatch[2]);
          const bucket = pathMatch[1];
          if (fileUrlCache.has(filePath)) return fileUrlCache.get(filePath)!;
          const signedUrl = await getSupabaseSignedUrl(filePath, bucket);
          if (signedUrl) {
            setFileUrlCache(prev => new Map(prev).set(filePath, signedUrl));
            setCacheVersion(v => v + 1);
            return signedUrl;
          }
        }
      } catch { }
    }
    return url;
  };
  const getFileUrlSync = (file: OrderFile): string => {
    let url = file.url || '';
    if (url && url.includes('supabase.co/storage')) {
      try {
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign\/[^/]+)\/([^/]+)\/(.+)/);
        if (pathMatch) {
          const filePath = decodeURIComponent(pathMatch[2]);
          if (fileUrlCache.has(filePath)) return fileUrlCache.get(filePath)!;
          if (isImage(getFileName(file), url, file.type)) getFileUrl(file).catch(() => { });
        }
      } catch { }
    }
    return url;
  };

  const handleDeleteFile = async () => {
    if (!deleteFileId || !selectedFile) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('order_files').delete().eq('id', deleteFileId);
      if (error) throw error;
      if (orderId && user && profile) {
        await supabase.from('timeline').insert({
          order_id: (await supabase.from('orders').select('id').eq('order_id', orderId).single()).data?.id,
          item_id: itemId || null,
          product_name: productName || null,
          stage: 'sales',
          action: 'note_added',
          performed_by: user.id,
          performed_by_name: profile.full_name || 'Unknown',
          notes: `File deleted: ${getFileName(selectedFile)}`,
          attachments: [{ url: selectedFile.url, type: selectedFile.type }],
          is_public: true
        });
      }
      toast({ title: "File deleted" });
      setPreviewOpen(false); setSelectedFile(null); onFileDeleted?.();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setIsDeleting(false); setDeleteFileId(null); }
  };

  const handlePreview = (file: OrderFile) => { setSelectedFile(file); setPreviewOpen(true); };

  const PreviewDialog = () => (
    <PreviewModal
      open={previewOpen}
      onOpenChange={setPreviewOpen}
      title={selectedFile ? getFileName(selectedFile) : 'File Preview'}
      onDownload={async () => {
        if (!selectedFile) return;
        const url = await getFileUrl(selectedFile);
        const link = document.createElement('a'); link.href = url; link.download = getFileName(selectedFile); link.target = '_blank';
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
      }}
      onOpen={async () => { if (selectedFile) window.open(await getFileUrl(selectedFile), '_blank'); }}
      onDelete={() => selectedFile && setDeleteFileId(selectedFile.file_id)}
      showDelete={selectedFile ? canDeleteFile(selectedFile) : false}
    >
      {selectedFile && <PreviewContent file={selectedFile} getFileName={getFileName} getFileUrlSync={getFileUrlSync} getFileUrl={getFileUrl} isPdf={isPdf} isImage={isImage} />}
    </PreviewModal>
  );

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* 1. Horizontal Scroll for Recent Files */}
      <div className="flex items-center gap-2">
        <div className="flex-1 overflow-x-auto no-scrollbar scroll-smooth">
          <div className="flex items-center gap-3 py-2 px-1">
            {recentFiles.map((file) => (
              <FileButton
                key={file.file_id}
                file={file}
                getFileName={getFileName}
                getFileUrlSync={getFileUrlSync}
                getFileUrl={getFileUrl}
                isImage={isImage}
                isPdf={isPdf}
                handlePreview={handlePreview}
                uploaderProfile={uploaderProfiles[file.uploaded_by]}
                fileUrlCache={fileUrlCache}
                cacheVersion={cacheVersion}
              />
            ))}
          </div>
        </div>

        {/* 2. History Box/Button if there are older files */}
        {olderFiles.length > 0 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-20 w-16 flex flex-col items-center justify-center gap-1 border-dashed rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 border-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-primary/10 p-1.5 rounded-full">
                  <History className="h-4 w-4 text-primary" />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground">+{olderFiles.length} History</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>File History</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                {Object.entries(groupedHistory).map(([dept, users]) => (
                  <div key={dept} className="space-y-3">
                    <div className="flex items-center gap-2 border-b pb-1">
                      <Badge variant="outline" className={`uppercase ${DEPT_COLORS[dept] || ''} border-0`}>
                        {dept}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{Object.values(users).flat().length} files</span>
                    </div>

                    <div className="space-y-4 pl-2">
                      {Object.entries(users).map(([userName, userFiles]) => (
                        <div key={userName} className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <UserCircleIcon name={userName} className="h-5 w-5 text-xs" />
                            {userName}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {userFiles.map(file => (
                              <FileButton
                                key={file.file_id}
                                file={file}
                                getFileName={getFileName}
                                getFileUrlSync={getFileUrlSync}
                                getFileUrl={getFileUrl}
                                isImage={isImage}
                                isPdf={isPdf}
                                handlePreview={handlePreview}
                                uploaderProfile={uploaderProfiles[file.uploaded_by]}
                                fileUrlCache={fileUrlCache}
                                cacheVersion={cacheVersion}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <PreviewDialog />

      <AlertDialog open={!!deleteFileId} onOpenChange={() => setDeleteFileId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>Are you sure?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFile} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

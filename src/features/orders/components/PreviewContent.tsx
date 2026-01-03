import { useState, useEffect } from 'react';
import { FileText, Download, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrderFile } from '@/types/order';
import { getSupabaseSignedUrl } from '@/services/supabaseStorage';

interface PreviewContentProps {
  file: OrderFile;
  getFileName: (file: OrderFile) => string;
  getFileUrlSync: (file: OrderFile) => string;
  getFileUrl: (file: OrderFile) => Promise<string>;
  isPdf: (fileName: string, fileUrl: string, fileType?: string) => boolean;
  isImage: (fileName: string, fileUrl: string, fileType?: string) => boolean;
}

export function PreviewContent({
  file,
  getFileName,
  getFileUrlSync,
  getFileUrl,
  isPdf,
  isImage,
}: PreviewContentProps) {
  const fileName = getFileName(file);
  const [currentFileUrl, setCurrentFileUrl] = useState<string>(getFileUrlSync(file));
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  // Fetch signed URL for selected file if needed
  useEffect(() => {
    const fetchUrl = async () => {
      const cachedUrl = getFileUrlSync(file);
      if (cachedUrl && !cachedUrl.includes('supabase.co/storage/v1/object/public')) {
        // Already have signed URL or non-Supabase URL
        setCurrentFileUrl(cachedUrl);
        return;
      }

      setIsLoadingUrl(true);
      try {
        const url = await getFileUrl(file);
        setCurrentFileUrl(url);
      } catch (error) {
        console.error('Error fetching signed URL:', error);
      } finally {
        setIsLoadingUrl(false);
      }
    };
    fetchUrl();
  }, [file, getFileUrl, getFileUrlSync]);

  const fileIsPdf = isPdf(fileName, currentFileUrl, file.type);
  const fileIsImage = isImage(fileName, currentFileUrl, file.type);

  // PDF preview using Google Docs Viewer or direct iframe
  if (fileIsPdf) {
    const encodedUrl = encodeURIComponent(currentFileUrl);
    const googleDocsViewerUrl = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;

    return (
      <div className="w-full h-[calc(95vh-180px)] min-h-[400px] flex items-center justify-center">
        {isLoadingUrl ? (
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading file...</p>
          </div>
        ) : (
          <iframe
            src={googleDocsViewerUrl}
            className="w-full h-full rounded-lg border border-border"
            title={fileName}
            allow="fullscreen"
            onError={() => {
              // Fallback: open PDF in new tab if viewer fails
              window.open(currentFileUrl, '_blank');
            }}
          />
        )}
      </div>
    );
  }

  // Image preview - responsive and centered with proper overflow
  if (fileIsImage) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[400px] overflow-auto bg-background rounded-lg">
        {isLoadingUrl ? (
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading image...</p>
          </div>
        ) : (
          <img
            src={currentFileUrl}
            alt={fileName}
            className="max-w-full max-h-[calc(95vh-250px)] w-auto h-auto object-contain rounded-lg"
            loading="lazy"
            crossOrigin="anonymous"
            onError={(e) => {
              // Fallback if image fails to load
              const target = e.currentTarget;
              const parent = target.parentElement;
              if (parent && !parent.querySelector('.image-fallback')) {
                target.style.display = 'none';
                const fallback = document.createElement('div');
                fallback.className = 'image-fallback flex flex-col items-center justify-center py-12 text-center w-full';
                const link = document.createElement('a');
                link.href = currentFileUrl;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.className = 'px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 inline-block mt-4';
                link.textContent = 'Open File';
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
        )}
      </div>
    );
  }

  // Other file types - show download option
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FileText className="h-16 w-16 text-muted-foreground mb-4" />
      <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            const link = document.createElement('a');
            link.href = currentFileUrl;
            link.download = fileName;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
        <Button variant="outline" onClick={() => window.open(currentFileUrl, '_blank')}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Open File
        </Button>
      </div>
    </div>
  );
}


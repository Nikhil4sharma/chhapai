import { useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface HoverPreviewProps {
  position: { x: number; y: number } | null;
  children: ReactNode;
  className?: string;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Portal-based hover preview component
 * Renders outside DOM hierarchy to avoid clipping issues
 * Only shows on devices that support hover
 */
export function HoverPreview({
  position,
  children,
  className,
  maxWidth = 240,
  maxHeight = 400,
}: HoverPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Prevent click events from bubbling (hover preview should not block clicks)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      e.stopPropagation();
    };

    container.addEventListener('click', handleClick);
    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, []);

  if (!position) return null;

  const previewContent = (
    <div
      ref={containerRef}
      className={cn(
        'fixed z-[9999] pointer-events-none',
        'bg-popover border border-border rounded-lg shadow-lg',
        'transition-opacity duration-200 ease-out',
        className
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        maxWidth: `${maxWidth}px`,
        maxHeight: `${maxHeight}px`,
        transform: 'translateZ(0)', // Force GPU acceleration
        animation: 'hoverPreviewFadeIn 0.2s ease-out',
      }}
    >
      <style>{`
        @keyframes hoverPreviewFadeIn {
          from {
            opacity: 0;
            transform: translateZ(0) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateZ(0) scale(1);
          }
        }
      `}</style>
      <div className="pointer-events-auto overflow-hidden rounded-lg">
        {children}
      </div>
    </div>
  );

  // Render to portal to avoid clipping
  return createPortal(previewContent, document.body);
}


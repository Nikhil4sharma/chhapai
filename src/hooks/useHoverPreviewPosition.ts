import { useState, useEffect, useRef, RefObject } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseHoverPreviewPositionOptions {
  enabled: boolean;
  offsetX?: number;
  offsetY?: number;
  previewWidth?: number;
  previewHeight?: number;
}

/**
 * Hook to track mouse position and calculate optimal preview position
 * Automatically flips preview to stay within viewport bounds
 */
export function useHoverPreviewPosition(
  triggerRef: RefObject<HTMLElement>,
  options: UseHoverPreviewPositionOptions
): Position | null {
  const { enabled, offsetX = 12, offsetY = 12, previewWidth = 240, previewHeight = 320 } = options;
  const [position, setPosition] = useState<Position | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || !triggerRef.current) {
      setPosition(null);
      return;
    }

    const element = triggerRef.current;
    let showDelayTimeout: NodeJS.Timeout | null = null;
    let isHovering = false;

    const calculatePosition = (e: MouseEvent) => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Calculate base position (cursor + offset)
      let x = e.clientX + offsetX;
      let y = e.clientY + offsetY;

      // Flip horizontally if near right edge
      if (x + previewWidth > viewportWidth) {
        x = e.clientX - previewWidth - offsetX;
        // Ensure it doesn't go off left edge
        if (x < 0) {
          x = offsetX;
        }
      }

      // Flip vertically if near bottom edge
      if (y + previewHeight > viewportHeight) {
        y = e.clientY - previewHeight - offsetY;
        // Ensure it doesn't go off top edge
        if (y < 0) {
          y = offsetY;
        }
      }

      // Ensure preview stays within viewport
      x = Math.max(offsetX, Math.min(x, viewportWidth - previewWidth - offsetX));
      y = Math.max(offsetY, Math.min(y, viewportHeight - previewHeight - offsetY));

      return { x, y };
    };

    const handleMouseEnter = () => {
      isHovering = true;
      // Get initial mouse position from the most recent mouse event
      // We'll update it on first mousemove
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (showDelayTimeout) {
        clearTimeout(showDelayTimeout);
        showDelayTimeout = null;
      }

      if (isHovering) {
        const pos = calculatePosition(e);
        setPosition(pos);
      } else {
        // If we just entered, show immediately after first move
        isHovering = true;
        const pos = calculatePosition(e);
        // Delay showing preview to prevent flicker
        showDelayTimeout = setTimeout(() => {
          if (isHovering) {
            setPosition(pos);
          }
        }, 150);
      }
    };

    const handleMouseLeave = () => {
      isHovering = false;
      if (showDelayTimeout) {
        clearTimeout(showDelayTimeout);
        showDelayTimeout = null;
      }
      setPosition(null);
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter as EventListener);
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
      if (showDelayTimeout) {
        clearTimeout(showDelayTimeout);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, offsetX, offsetY, previewWidth, previewHeight, triggerRef]);

  return position;
}


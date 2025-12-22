import { useState, useEffect } from 'react';

/**
 * Hook to detect if the device supports hover (pointer: fine)
 * Returns true only for devices with precise pointing devices (mouse, trackpad)
 * Returns false for touch devices
 */
export function useHoverCapability(): boolean {
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    // Check if device supports hover using media query
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    
    // Set initial value
    setCanHover(mediaQuery.matches);

    // Listen for changes (e.g., device rotation, external mouse connected)
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setCanHover(e.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => {
        mediaQuery.removeListener(handleChange);
      };
    }
  }, []);

  return canHover;
}


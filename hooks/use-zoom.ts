import { useState, useCallback, useEffect, useRef } from 'react';

export type ZoomMode = 'custom' | 'fit' | 'autofit';

interface UseZoomOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentWidth: number; // iframe width in pixels
  contentHeight: number; // iframe height in pixels
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
}

interface UseZoomResult {
  zoom: number;
  zoomMode: ZoomMode;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoomTo: (zoom: number) => void;
  resetZoom: () => void;
  zoomToFit: () => void;
  autofit: () => void;
  handleZoomGesture: (delta: number) => void;
  lockZoomMode: () => void; // Lock current zoom to custom mode
  scrollPosition: { x: number; y: number };
}

export function useZoom({
  containerRef,
  contentWidth,
  contentHeight,
  minZoom = 10,
  maxZoom = 200,
  zoomStep = 10,
}: UseZoomOptions): UseZoomResult {
  const [zoom, setZoom] = useState(100);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('autofit'); // Default to autofit
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });

  // Calculate zoom to fit vertically
  const calculateZoomToFit = useCallback((): number => {
    if (!containerRef.current) return 100;
    
    const containerHeight = containerRef.current.clientHeight;
    
    // Calculate zoom that fits content vertically with padding
    const padding = 64; // 32px top + 32px bottom
    const availableHeight = containerHeight - padding;
    const verticalZoom = (availableHeight / contentHeight) * 100;
    
    // Clamp between min and max
    return Math.min(Math.max(verticalZoom, minZoom), maxZoom);
  }, [containerRef, contentHeight, minZoom, maxZoom]);

  // Calculate autofit (fits horizontally)
  const calculateAutofit = useCallback((): number => {
    if (!containerRef.current) return 100;
    
    const containerWidth = containerRef.current.clientWidth;
    
    // Calculate zoom that fits content horizontally with padding
    const padding = 64; // 32px left + 32px right
    const availableWidth = containerWidth - padding;
    const horizontalZoom = (availableWidth / contentWidth) * 100;
    
    // Clamp between min and max
    return Math.min(Math.max(horizontalZoom, minZoom), maxZoom);
  }, [containerRef, contentWidth, minZoom, maxZoom]);

  // Zoom in
  const zoomIn = useCallback(() => {
    setZoom((current) => Math.min(current + zoomStep, maxZoom));
    setZoomMode('custom');
  }, [zoomStep, maxZoom]);

  // Zoom out
  const zoomOut = useCallback(() => {
    setZoom((current) => Math.max(current - zoomStep, minZoom));
    setZoomMode('custom');
  }, [zoomStep, minZoom]);

  // Set specific zoom
  const setZoomTo = useCallback((newZoom: number) => {
    setZoom(Math.min(Math.max(newZoom, minZoom), maxZoom));
    setZoomMode('custom');
  }, [minZoom, maxZoom]);

  // Reset to 100%
  const resetZoom = useCallback(() => {
    setZoom(100);
    setZoomMode('custom');
  }, []);

  // Zoom to fit (vertical)
  const zoomToFit = useCallback(() => {
    const newZoom = calculateZoomToFit();
    setZoom(newZoom);
    setZoomMode('fit');
  }, [calculateZoomToFit]);

  // Autofit (horizontal)
  const autofit = useCallback(() => {
    const newZoom = calculateAutofit();
    setZoom(newZoom);
    setZoomMode('autofit');
  }, [calculateAutofit]);

  // Initialize with autofit on mount
  useEffect(() => {
    // Small delay to ensure container is mounted and has dimensions
    const timer = setTimeout(() => {
      const initialZoom = calculateAutofit();
      setZoom(initialZoom);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []); // Empty deps - only run on mount

  // Handle zoom gesture (from iframe or external source)
  const handleZoomGesture = useCallback((delta: number) => {
    // Delta comes from iframe wheel events with variable values
    // Scale appropriately for smooth zooming (same as parent wheel handler)
    const sensitivity = 0.5;
    const zoomDelta = -delta * sensitivity; // Negative to match wheel direction
    
    setZoom((current) => {
      const newZoom = current + zoomDelta;
      return Math.min(Math.max(newZoom, minZoom), maxZoom);
    });
    setZoomMode('custom');
  }, [minZoom, maxZoom]);

  // Lock current zoom to custom mode (prevents auto-recalculation)
  const lockZoomMode = useCallback(() => {
    setZoomMode('custom');
  }, []);

  // Recalculate zoom when mode is fit/autofit and container resizes
  useEffect(() => {
    if (!containerRef.current || zoomMode === 'custom') return;

    const handleResize = () => {
      if (zoomMode === 'fit') {
        const newZoom = calculateZoomToFit();
        setZoom(newZoom);
      } else if (zoomMode === 'autofit') {
        const newZoom = calculateAutofit();
        setZoom(newZoom);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, zoomMode, calculateZoomToFit, calculateAutofit]);

  // Keyboard shortcuts - capture at window level with high priority
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      
      if (!isCmdOrCtrl) return;

      // Check for zoom shortcuts and prevent default browser behavior
      const isZoomShortcut = 
        e.key === '+' || 
        e.key === '=' || 
        e.key === '-' || 
        e.key === '_' || 
        e.key === '0' ||
        e.key === '1' ||
        e.key === '2';

      if (!isZoomShortcut) return;

      // ALWAYS prevent default to stop browser zoom
      e.preventDefault();
      e.stopPropagation();

      switch (e.key) {
        case '+':
        case '=': // Handle both + and = keys
          zoomIn();
          break;
        case '-':
        case '_':
          zoomOut();
          break;
        case '0':
          resetZoom();
          break;
        case '1':
          zoomToFit();
          break;
        case '2':
          autofit();
          break;
      }
    };

    // Add listener with capture phase to intercept before other handlers
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [zoomIn, zoomOut, resetZoom, zoomToFit, autofit]);

  // Ctrl/Cmd + wheel to zoom (includes trackpad pinch) - GLOBAL, works everywhere
  // Also prevents native browser zoom COMPLETELY
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // ALWAYS prevent default browser zoom, everywhere
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Trackpad pinch sends much smaller deltaY values than mouse wheel
        // Scale the delta appropriately for smooth zooming
        const sensitivity = 0.5; // Adjust sensitivity for trackpad pinch
        const zoomDelta = -e.deltaY * sensitivity; // Negative because deltaY is inverted
        
        setZoom((current) => {
          const newZoom = current + zoomDelta;
          return Math.min(Math.max(newZoom, minZoom), maxZoom);
        });
        setZoomMode('custom');
        
        return false; // Extra prevention
      }
    };

    // Prevent native zoom via gesturestart/gesturechange (Safari/Mac specific)
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    const handleGestureChange = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Attach to document for maximum coverage - works everywhere
    document.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    
    // Safari gesture events
    document.addEventListener('gesturestart', handleGestureStart, { passive: false, capture: true });
    document.addEventListener('gesturechange', handleGestureChange, { passive: false, capture: true });
    
    return () => {
      document.removeEventListener('wheel', handleWheel, { capture: true } as EventListenerOptions);
      document.removeEventListener('gesturestart', handleGestureStart, { capture: true } as EventListenerOptions);
      document.removeEventListener('gesturechange', handleGestureChange, { capture: true } as EventListenerOptions);
    };
  }, [minZoom, maxZoom]);

  return {
    zoom,
    zoomMode,
    zoomIn,
    zoomOut,
    setZoomTo,
    resetZoom,
    zoomToFit,
    autofit,
    handleZoomGesture,
    lockZoomMode,
    scrollPosition,
  };
}

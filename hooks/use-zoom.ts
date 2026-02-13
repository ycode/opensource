import { useState, useCallback, useEffect, useRef } from 'react';
import { CANVAS_PADDING } from '@/lib/canvas-utils';

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

  // Calculate zoom to fit height (prioritizes vertical fit, width follows)
  // Returns null if container is hidden (0 dimensions) to preserve current zoom
  const calculateZoomToFit = useCallback((): number | null => {
    if (!containerRef.current) return null;

    const containerHeight = containerRef.current.clientHeight;
    // Skip calculation when container is hidden (e.g. tab switch to CMS)
    if (containerHeight === 0) return null;

    // Calculate zoom based on height with padding
    const availableHeight = containerHeight - CANVAS_PADDING;
    const verticalZoom = (availableHeight / contentHeight) * 100;

    // Clamp between min and 100% (never zoom in more than 100%)
    return Math.min(Math.max(verticalZoom, minZoom), 100);
  }, [containerRef, contentHeight, minZoom]);

  // Calculate autofit (fits horizontally)
  // Returns null if container is hidden (0 dimensions) to preserve current zoom
  const calculateAutofit = useCallback((): number | null => {
    if (!containerRef.current) return null;

    const containerWidth = containerRef.current.clientWidth;
    // Skip calculation when container is hidden (e.g. tab switch to CMS)
    if (containerWidth === 0) return null;

    // Calculate zoom that fits content horizontally with padding
    const availableWidth = containerWidth - CANVAS_PADDING;
    const horizontalZoom = (availableWidth / contentWidth) * 100;

    // Clamp between min and 100% (never zoom in more than 100%)
    return Math.min(Math.max(horizontalZoom, minZoom), 100);
  }, [containerRef, contentWidth, minZoom]);

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
    if (newZoom === null) return; // Container hidden, preserve current zoom
    setZoom(newZoom);
    setZoomMode('fit');
  }, [calculateZoomToFit]);

  // Autofit (horizontal)
  const autofit = useCallback(() => {
    const newZoom = calculateAutofit();
    if (newZoom === null) return; // Container hidden, preserve current zoom
    setZoom(newZoom);
    setZoomMode('autofit');
  }, [calculateAutofit]);

  // Handle zoom gesture (from iframe or external source)
  const handleZoomGesture = useCallback((delta: number) => {
    // Delta from iframe is already normalized: positive = zoom in, negative = zoom out
    // Scale appropriately for smooth zooming
    const sensitivity = 0.5;
    const zoomDelta = delta * sensitivity; // No negation - iframe already normalized

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

  // Recalculate zoom when mode is fit/autofit and container resizes or content dimensions change
  useEffect(() => {
    if (!containerRef.current || zoomMode === 'custom') return;

    const handleResize = () => {
      // Don't calculate if content dimensions aren't ready yet
      if (contentWidth === 0 || contentHeight === 0) return;

      if (zoomMode === 'fit') {
        const newZoom = calculateZoomToFit();
        if (newZoom !== null) setZoom(newZoom);
      } else if (zoomMode === 'autofit') {
        const newZoom = calculateAutofit();
        if (newZoom !== null) setZoom(newZoom);
      }
    };

    // Recalculate immediately when content dimensions change
    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, zoomMode, calculateZoomToFit, calculateAutofit, contentWidth, contentHeight]);

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
  };
}

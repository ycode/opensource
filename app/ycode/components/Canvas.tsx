'use client';

/**
 * Canvas Component
 *
 * Renders the layer editor canvas using an embedded iframe with Tailwind Browser CDN.
 * The iframe provides complete style isolation while allowing React-based layer rendering.
 *
 * Architecture:
 * - An iframe is created with Tailwind Browser CDN loaded
 * - React components are rendered into the iframe via ReactDOM.createRoot
 * - Communication happens via direct function calls (no postMessage needed)
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createRoot, Root } from 'react-dom/client';

import LayerRenderer from '@/components/LayerRenderer';
import { serializeLayers } from '@/lib/layer-utils';
import { cn } from '@/lib/utils';

import type { Layer, Component, CollectionItemWithValues, CollectionField, Breakpoint, Asset } from '@/types';
import type { UseLiveLayerUpdatesReturn } from '@/hooks/use-live-layer-updates';
import type { UseLiveComponentUpdatesReturn } from '@/hooks/use-live-component-updates';

interface CanvasProps {
  /** Layers to render */
  layers: Layer[];
  /** Components for resolving component instances */
  components: Component[];
  /** Currently selected layer ID */
  selectedLayerId: string | null;
  /** Currently hovered layer ID */
  hoveredLayerId: string | null;
  /** Current breakpoint/viewport mode */
  breakpoint: Breakpoint;
  /** Active UI state for preview (hover, focus, etc.) */
  activeUIState: 'neutral' | 'hover' | 'focus' | 'active' | 'disabled' | 'current';
  /** Whether a component is being edited */
  editingComponentId: string | null;
  /** Collection items by collection ID */
  collectionItems: Record<string, CollectionItemWithValues[]>;
  /** Collection fields by collection ID */
  collectionFields: Record<string, CollectionField[]>;
  /** Collection item for dynamic page preview */
  pageCollectionItem?: CollectionItemWithValues | null;
  /** Collection fields for dynamic page */
  pageCollectionFields?: CollectionField[];
  /** Assets map */
  assets: Record<string, Asset>;
  /** Collection layer data by layer ID */
  collectionLayerData: Record<string, CollectionItemWithValues[]>;
  /** Page ID */
  pageId: string;
  /** Callback when a layer is clicked */
  onLayerClick?: (layerId: string, event?: React.MouseEvent) => void;
  /** Callback when a layer is updated */
  onLayerUpdate?: (layerId: string, updates: Partial<Layer>) => void;
  /** Callback when delete key is pressed */
  onDeleteLayer?: () => void;
  /** Callback when content height changes */
  onContentHeightChange?: (height: number) => void;
  /** Callback when gap is updated */
  onGapUpdate?: (layerId: string, gapValue: string) => void;
  /** Callback when zoom gesture is detected */
  onZoomGesture?: (delta: number) => void;
  /** Callback when zoom in is triggered (Cmd++) */
  onZoomIn?: () => void;
  /** Callback when zoom out is triggered (Cmd+-) */
  onZoomOut?: () => void;
  /** Callback when reset zoom is triggered (Cmd+0) */
  onResetZoom?: () => void;
  /** Callback when zoom to fit is triggered (Cmd+1) */
  onZoomToFit?: () => void;
  /** Callback when autofit is triggered (Cmd+2) */
  onAutofit?: () => void;
  /** Callback when undo is triggered (Cmd+Z) */
  onUndo?: () => void;
  /** Callback when redo is triggered (Cmd+Shift+Z) */
  onRedo?: () => void;
  /** Live layer updates for collaboration */
  liveLayerUpdates?: UseLiveLayerUpdatesReturn | null;
  /** Live component updates for collaboration */
  liveComponentUpdates?: UseLiveComponentUpdatesReturn | null;
  /** Callback when iframe is ready, provides the iframe element */
  onIframeReady?: (iframeElement: HTMLIFrameElement) => void;
  /** Callback when a layer is hovered (for external overlay) */
  onLayerHover?: (layerId: string | null) => void;
  /** Callback when any click occurs inside the canvas (for closing panels) */
  onCanvasClick?: () => void;
  /** Component variables when editing a component (for default value display) */
  editingComponentVariables?: { id: string; name: string; default_value?: any }[];
}

/**
 * Inner component that renders inside the iframe
 */
interface CanvasContentProps {
  layers: Layer[];
  selectedLayerId: string | null;
  hoveredLayerId: string | null;
  pageId: string;
  pageCollectionItemData: Record<string, string> | null;
  onLayerClick: (layerId: string, event?: React.MouseEvent) => void;
  onLayerUpdate?: (layerId: string, updates: Partial<Layer>) => void;
  onLayerHover: (layerId: string | null) => void;
  liveLayerUpdates?: UseLiveLayerUpdatesReturn | null;
  liveComponentUpdates?: UseLiveComponentUpdatesReturn | null;
  editingComponentVariables?: { id: string; name: string; default_value?: any }[];
}

function CanvasContent({
  layers,
  selectedLayerId,
  hoveredLayerId,
  pageId,
  pageCollectionItemData,
  onLayerClick,
  onLayerUpdate,
  onLayerHover,
  liveLayerUpdates,
  liveComponentUpdates,
  editingComponentVariables,
}: CanvasContentProps) {
  // Handle click on canvas body (select body when clicking on empty space)
  const handleBodyClick = (event: React.MouseEvent) => {
    // Only select body if clicking directly on it (not on a child layer)
    if (event.target === event.currentTarget) {
      onLayerClick('body', event);
    }
  };

  return (
    <div
      id="canvas-body"
      data-layer-id="body"
      className="h-full min-h-full bg-white"
      onClick={handleBodyClick}
    >
      {layers.length > 0 ? (
        <LayerRenderer
          layers={layers}
          isEditMode={true}
          isPublished={false}
          selectedLayerId={selectedLayerId}
          hoveredLayerId={hoveredLayerId}
          onLayerClick={onLayerClick}
          onLayerUpdate={onLayerUpdate}
          onLayerHover={onLayerHover}
          pageId={pageId}
          pageCollectionItemData={pageCollectionItemData}
          liveLayerUpdates={liveLayerUpdates}
          liveComponentUpdates={liveComponentUpdates}
          editingComponentVariables={editingComponentVariables}
        />
      ) : (
        <div className="flex items-center justify-center min-h-[200px] text-gray-400">
          No layers to display
        </div>
      )}
    </div>
  );
}

/**
 * Canvas Component
 * Uses an embedded iframe with Tailwind Browser CDN for style generation
 */
export default function Canvas({
  layers,
  components,
  selectedLayerId,
  hoveredLayerId,
  breakpoint,
  activeUIState,
  editingComponentId,
  collectionItems,
  collectionFields,
  pageCollectionItem,
  pageCollectionFields,
  assets,
  collectionLayerData,
  pageId,
  onLayerClick,
  onLayerUpdate,
  onDeleteLayer,
  onContentHeightChange,
  onGapUpdate,
  onZoomGesture,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onZoomToFit,
  onAutofit,
  onUndo,
  onRedo,
  liveLayerUpdates,
  liveComponentUpdates,
  onIframeReady,
  onLayerHover,
  onCanvasClick,
  editingComponentVariables,
}: CanvasProps) {
  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const rootRef = useRef<Root | null>(null);
  const mountPointRef = useRef<HTMLDivElement | null>(null);

  // State
  const [iframeReady, setIframeReady] = useState(false);
  const [internalHoveredLayerId, setInternalHoveredLayerId] = useState<string | null>(null);
  const effectiveHoveredLayerId = hoveredLayerId ?? internalHoveredLayerId;

  // Resolve component instances in layers
  const { layers: resolvedLayers, componentMap } = useMemo(() => {
    return serializeLayers(layers, components);
  }, [layers, components]);

  // Handle layer click with component resolution
  const handleLayerClick = useCallback((layerId: string, event?: React.MouseEvent) => {
    const componentRootId = componentMap[layerId];
    const isPartOfComponent = !!componentRootId;
    const isEditingThisComponent = editingComponentId && componentRootId === editingComponentId;

    let targetLayerId = layerId;
    if (isPartOfComponent && !isEditingThisComponent) {
      targetLayerId = componentRootId;
    }

    onLayerClick?.(targetLayerId, event);
  }, [componentMap, editingComponentId, onLayerClick]);

  // Handle hover
  const handleLayerHover = useCallback((layerId: string | null) => {
    // Resolve component root for hover (same logic as click)
    let resolvedLayerId = layerId;
    if (layerId) {
      const componentRootId = componentMap[layerId];
      const isPartOfComponent = !!componentRootId;
      const isEditingThisComponent = editingComponentId && componentRootId === editingComponentId;

      if (isPartOfComponent && !isEditingThisComponent) {
        resolvedLayerId = componentRootId;
      }
    }

    setInternalHoveredLayerId(resolvedLayerId);
    onLayerHover?.(resolvedLayerId);
  }, [componentMap, editingComponentId, onLayerHover]);

  // Initialize iframe with Tailwind Browser CDN (only once)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Guard against re-initialization
    if (rootRef.current) return;

    const initializeIframe = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      // Double-check we haven't already initialized
      if (rootRef.current) return;

      // Write the initial HTML with Tailwind Browser CDN
      doc.open();
      doc.write(`
<!DOCTYPE html>
<html style="height: 100%;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <style type="text/tailwindcss">
    @theme {
      /* Use default Tailwind theme */
    }
  </style>
  <link rel="stylesheet" href="/canvas.css">
  <!-- GSAP for animations (now free thanks to Webflow) -->
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/SplitText.min.js"></script>
  <script>
    // Register SplitText plugin in iframe context
    if (typeof gsap !== 'undefined' && typeof SplitText !== 'undefined') {
      gsap.registerPlugin(SplitText);
    }
  </script>
</head>
<body style="margin: 0; padding: 0; height: 100%;">
  <div id="canvas-mount" style="height: 100%;"></div>
</body>
</html>
      `);
      doc.close();

      // Wait for Tailwind to initialize
      setTimeout(() => {
        // Final guard before creating root
        if (rootRef.current) return;

        const mountPoint = doc.getElementById('canvas-mount');
        if (mountPoint) {
          mountPointRef.current = mountPoint as HTMLDivElement;
          rootRef.current = createRoot(mountPoint);
          setIframeReady(true);
        }
      }, 100);
    };

    // Initialize when iframe loads
    iframe.onload = initializeIframe;

    // Trigger initial load if iframe is already ready
    if (iframe.contentDocument?.readyState === 'complete') {
      initializeIframe();
    }

    return () => {
      // Cleanup on unmount - defer to avoid unmounting during React's render phase
      const rootToUnmount = rootRef.current;
      rootRef.current = null;
      mountPointRef.current = null;
      setIframeReady(false);

      // Defer unmount to next frame to ensure we're outside React's render cycle
      if (rootToUnmount) {
        requestAnimationFrame(() => {
          try {
            rootToUnmount.unmount();
          } catch (error) {
            console.warn('Error unmounting canvas root:', error);
          }
        });
      }
    };
  }, []); // Empty deps - only run once on mount

  // Notify parent when iframe is ready
  useEffect(() => {
    if (iframeReady && iframeRef.current && onIframeReady) {
      onIframeReady(iframeRef.current);
    }
  }, [iframeReady, onIframeReady]);

  // Render content into iframe
  useEffect(() => {
    if (!iframeReady || !rootRef.current) return;

    rootRef.current.render(
      <CanvasContent
        layers={resolvedLayers}
        selectedLayerId={selectedLayerId}
        hoveredLayerId={effectiveHoveredLayerId}
        pageId={pageId}
        pageCollectionItemData={pageCollectionItem?.values || null}
        onLayerClick={handleLayerClick}
        onLayerUpdate={onLayerUpdate}
        onLayerHover={handleLayerHover}
        liveLayerUpdates={liveLayerUpdates}
        liveComponentUpdates={liveComponentUpdates}
        editingComponentVariables={editingComponentVariables}
      />
    );
  }, [
    iframeReady,
    resolvedLayers,
    editingComponentVariables,
    selectedLayerId,
    effectiveHoveredLayerId,
    pageId,
    pageCollectionItem,
    handleLayerClick,
    onLayerUpdate,
    handleLayerHover,
    liveLayerUpdates,
    liveComponentUpdates,
  ]);

  // Handle keyboard events from iframe
  useEffect(() => {
    if (!iframeReady || !iframeRef.current) return;

    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' ||
                             target.tagName === 'TEXTAREA' ||
                             target.isContentEditable;

      // Delete/Backspace for layer deletion
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayerId && !isInputFocused) {
        e.preventDefault();
        onDeleteLayer?.();
        return;
      }

      // Undo/Redo shortcuts (Cmd/Ctrl + Z / Shift + Z, or Cmd/Ctrl + Y)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !isInputFocused) {
        e.preventDefault();
        if (e.shiftKey) {
          // Redo: Cmd/Ctrl + Shift + Z
          onRedo?.();
        } else {
          // Undo: Cmd/Ctrl + Z
          onUndo?.();
        }
        return;
      }

      // Redo alternative: Cmd/Ctrl + Y
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y' && !isInputFocused) {
        e.preventDefault();
        onRedo?.();
        return;
      }

      // Zoom shortcuts (Cmd/Ctrl + key)
      if (e.metaKey || e.ctrlKey) {
        // Cmd+0 - Reset zoom
        if (e.key === '0' && onResetZoom) {
          e.preventDefault();
          onResetZoom();
          return;
        }

        // Cmd++ or Cmd+= - Zoom in
        if ((e.key === '+' || e.key === '=') && onZoomIn) {
          e.preventDefault();
          onZoomIn();
          return;
        }

        // Cmd+- - Zoom out
        if (e.key === '-' && onZoomOut) {
          e.preventDefault();
          onZoomOut();
          return;
        }

        // Cmd+1 - Fit height
        if (e.key === '1' && onZoomToFit) {
          e.preventDefault();
          onZoomToFit();
          return;
        }

        // Cmd+2 - Fit width
        if (e.key === '2' && onAutofit) {
          e.preventDefault();
          onAutofit();
          return;
        }
      }

      // Forward keyboard events to parent window for global shortcuts
      // (copy, paste, undo, redo, copy style, paste style, etc.)
      if (!isInputFocused) {
        const syntheticEvent = new KeyboardEvent('keydown', {
          key: e.key,
          code: e.code,
          keyCode: e.keyCode,
          which: e.which,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(syntheticEvent);
      }
    };

    doc.addEventListener('keydown', handleKeyDown);
    return () => doc.removeEventListener('keydown', handleKeyDown);
  }, [iframeReady, selectedLayerId, onDeleteLayer, onResetZoom, onZoomIn, onZoomOut, onZoomToFit, onAutofit, onUndo, onRedo]);

  // Handle any click inside the iframe (capture phase to run before stopPropagation)
  useEffect(() => {
    if (!iframeReady || !iframeRef.current) return;

    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    const handleClick = () => {
      onCanvasClick?.();
    };

    // Use capture phase to ensure we catch clicks before stopPropagation
    doc.addEventListener('click', handleClick, true);
    return () => doc.removeEventListener('click', handleClick, true);
  }, [iframeReady, onCanvasClick]);

  // Content height reporting
  useEffect(() => {
    if (!iframeReady || !iframeRef.current || !onContentHeightChange) return;

    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    const measureHeight = () => {
      const body = doc.body;
      if (body) {
        const height = Math.max(
          body.scrollHeight,
          body.offsetHeight,
          doc.documentElement?.scrollHeight || 0,
          doc.documentElement?.offsetHeight || 0
        );
        onContentHeightChange(Math.max(height, 100));
      }
    };

    // Measure after render
    const timeoutId = setTimeout(measureHeight, 100);

    // Observe for changes
    const observer = new MutationObserver(() => {
      requestAnimationFrame(measureHeight);
    });

    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [iframeReady, onContentHeightChange, resolvedLayers]);

  // Handle zoom gestures from iframe (Ctrl+wheel, trackpad pinch)
  useEffect(() => {
    if (!iframeReady || !iframeRef.current || !onZoomGesture) return;

    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        // Positive deltaY means zoom out, negative means zoom in
        const delta = -e.deltaY;
        onZoomGesture(delta);

        return false;
      }
    };

    doc.addEventListener('wheel', handleWheel, { passive: false, capture: true });

    return () => {
      doc.removeEventListener('wheel', handleWheel);
    };
  }, [iframeReady, onZoomGesture]);

  return (
    <iframe
      ref={iframeRef}
      className={cn(
        'w-full h-full border-0 bg-white'
      )}
      title="Canvas Editor"
      tabIndex={-1}
    />
  );
}

'use client';

/**
 * Center Canvas - Preview Area
 * 
 * Shows live preview of the website being built
 */

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  closestCenter,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { usePagesStore } from '../../../stores/usePagesStore';
import { useEditorStore } from '../../../stores/useEditorStore';
import LayerRenderer from '../../../components/layers/LayerRenderer';
import type { Layer } from '../../../types';
import {
  flattenTree,
  getProjection,
} from '../../../lib/tree-utilities';

type ViewportMode = 'desktop' | 'tablet' | 'mobile';

interface CenterCanvasProps {
  selectedLayerId: string | null;
  currentPageId: string | null;
  viewportMode: ViewportMode;
  zoom: number;
}

const viewportSizes: Record<ViewportMode, { width: string; label: string; icon: string }> = {
  desktop: { width: '1200px', label: 'Desktop', icon: '🖥️' },
  tablet: { width: '768px', label: 'Tablet', icon: '📱' },
  mobile: { width: '375px', label: 'Mobile', icon: '📱' },
};

export default function CenterCanvas({
  selectedLayerId,
  currentPageId,
  viewportMode,
  zoom,
}: CenterCanvasProps) {
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [collapsedIds] = useState<Set<string>>(new Set()); // Canvas doesn't show collapse
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { draftsByPageId, updateLayer, moveLayer } = usePagesStore();
  const { setSelectedLayerId } = useEditorStore();

  // Track mouse position during drag
  useEffect(() => {
    if (!activeLayerId) return;
    
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      // Use clientY for potential future use
      void clientY;
    };
    
    document.addEventListener('mousemove', handlePointerMove as any);
    document.addEventListener('touchmove', handlePointerMove as any);
    
    return () => {
      document.removeEventListener('mousemove', handlePointerMove as any);
      document.removeEventListener('touchmove', handlePointerMove as any);
    };
  }, [activeLayerId]);

  // Configure drag sensors with auto-scroll enabled
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  // Auto-scroll when dragging near edges
  useEffect(() => {
    if (!activeLayerId || !scrollContainerRef.current) return;

    let animationFrame: number;
    const handleAutoScroll = (e: MouseEvent) => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      
      animationFrame = requestAnimationFrame(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const threshold = 50; // pixels from edge to trigger scroll
        const scrollSpeed = 10;

        // Calculate distances from edges
        const distanceFromTop = e.clientY - rect.top;
        const distanceFromBottom = rect.bottom - e.clientY;
        const distanceFromLeft = e.clientX - rect.left;
        const distanceFromRight = rect.right - e.clientX;

        // Scroll up
        if (distanceFromTop < threshold && distanceFromTop > 0) {
          container.scrollTop -= scrollSpeed * (1 - distanceFromTop / threshold);
        }
        // Scroll down
        if (distanceFromBottom < threshold && distanceFromBottom > 0) {
          container.scrollTop += scrollSpeed * (1 - distanceFromBottom / threshold);
        }
        // Scroll left
        if (distanceFromLeft < threshold && distanceFromLeft > 0) {
          container.scrollLeft -= scrollSpeed * (1 - distanceFromLeft / threshold);
        }
        // Scroll right
        if (distanceFromRight < threshold && distanceFromRight > 0) {
          container.scrollLeft += scrollSpeed * (1 - distanceFromRight / threshold);
        }
      });
    };

    document.addEventListener('mousemove', handleAutoScroll);
    return () => {
      document.removeEventListener('mousemove', handleAutoScroll);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [activeLayerId]);

  const layers = useMemo(() => {
    if (!currentPageId) {
      return [];
    }
    
    const draft = draftsByPageId[currentPageId];
    return draft ? draft.layers : [];
  }, [currentPageId, draftsByPageId]);

  const handleLayerUpdate = (layerId: string, updates: Partial<Layer>) => {
    if (currentPageId) {
      updateLayer(currentPageId, layerId, updates);
    }
  };

  // Flatten tree for sortable
  const flattenedLayers = useMemo(() => {
    return flattenTree(layers, null, 0, collapsedIds);
  }, [layers, collapsedIds]);

  const sortedIds = useMemo(() => {
    return flattenedLayers.map(item => item.id);
  }, [flattenedLayers]);

  // Calculate projection during drag
  const projected = useMemo(() => {
    if (!activeLayerId || !overId) return null;
    return getProjection(flattenedLayers, activeLayerId, overId, offsetLeft);
  }, [activeLayerId, overId, offsetLeft, flattenedLayers]);

  // Handle drag events
  const handleDragStart = (event: DragStartEvent) => {
    setActiveLayerId(event.active.id as string);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    // Canvas restriction: Disable depth changes by always keeping offsetLeft at 0
    setOffsetLeft(0);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveLayerId(null);
    setOverId(null);
    setOffsetLeft(0);

    if (!over || !currentPageId) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    // Find current parent of active layer
    const activeItem = flattenedLayers.find(item => item.id === activeId);
    if (!activeItem) return;

    // Get projection for final position
    const projection = getProjection(flattenedLayers, activeId, overId, offsetLeft);
    
    if (!projection) return;

    // CANVAS RESTRICTION: Only allow reordering within same parent
    if (projection.parentId !== activeItem.parentId) {
      console.log('[Canvas] Cannot move to different container on canvas - use sidebar for structural changes');
      return; // Reject cross-container moves
    }

    // Find insertion index
    const overIndex = flattenedLayers.findIndex(item => item.id === overId);
    if (overIndex === -1) return;

    // Calculate target index within parent's children
    const { parentId } = projection;
    const itemsWithSameParent = flattenedLayers.filter(
      item => item.parentId === parentId
    );
    
    let targetIndex = 0;
    for (let i = 0; i < itemsWithSameParent.length; i++) {
      const itemIndex = flattenedLayers.findIndex(fi => fi.id === itemsWithSameParent[i].id);
      if (itemIndex <= overIndex) {
        targetIndex = i + 1;
      }
    }

    // Perform the move
    const success = moveLayer(currentPageId, activeId, parentId, targetIndex);
    
    if (!success) {
      console.warn('[Canvas] Move operation failed - invalid drop target');
    }
  };

  const handleDragCancel = () => {
    setActiveLayerId(null);
    setOverId(null);
    setOffsetLeft(0);
  };

  return (
    <div className="flex-1 bg-zinc-950 flex flex-col">
      {/* Canvas Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 flex items-start justify-center p-8 overflow-auto bg-zinc-900"
      >
        <div 
          className="bg-white shadow-2xl transition-all origin-top"
          style={{ 
            transform: `scale(${zoom / 100})`,
            width: viewportSizes[viewportMode].width,
            minHeight: '800px',
          }}
        >
          {/* Preview Content */}
          {layers.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
              measuring={{
                droppable: {
                  strategy: MeasuringStrategy.Always,
                },
              }}
            >
              <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
                <LayerRenderer
                  layers={layers}
                  selectedLayerId={selectedLayerId}
                  onLayerClick={(id) => setSelectedLayerId(id)}
                  onLayerUpdate={handleLayerUpdate}
                  enableDragDrop={true}
                  activeLayerId={activeLayerId}
                  projected={projected}
                />
              </SortableContext>
            </DndContext>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[400px] text-gray-400">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 5a1 1 0 011-1h4a1 1 0 010 2H6v2a1 1 0 11-2 0V5zm16 0a1 1 0 00-1-1h-4a1 1 0 100 2h2v2a1 1 0 102 0V5zM4 19a1 1 0 001 1h4a1 1 0 100-2H6v-2a1 1 0 10-2 0v3zm16 0a1 1 0 01-1 1h-4a1 1 0 110-2h2v-2a1 1 0 112 0v3z"
                  />
                </svg>
                <p className="text-lg font-medium mb-1">Empty Canvas</p>
                <p className="text-sm">Add layers from the sidebar to start building</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

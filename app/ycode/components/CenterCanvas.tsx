'use client';

/**
 * Center Canvas - Preview Area with Isolated Iframe
 *
 * Shows live preview of the website being built using Tailwind JIT CDN
 */

// 1. React/Next.js
import { useEffect, useRef, useMemo, useState, useCallback } from 'react';

// 3. ShadCN UI
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// 5. Stores
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';

// 6. Utils
import { sendToIframe, listenToIframe, serializeLayers } from '@/lib/iframe-bridge';
import type { IframeToParentMessage } from '@/lib/iframe-bridge';

// 7. Types
import type { Layer } from '@/types';

type ViewportMode = 'desktop' | 'tablet' | 'mobile';

interface CenterCanvasProps {
  selectedLayerId: string | null;
  currentPageId: string | null;
  viewportMode: ViewportMode;
  setViewportMode: (mode: ViewportMode) => void;
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
  setViewportMode,
  zoom,
}: CenterCanvasProps) {
  const [showAddBlockPanel, setShowAddBlockPanel] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { draftsByPageId, addLayer, updateLayer } = usePagesStore();
  const { setSelectedLayerId } = useEditorStore();

  const layers = useMemo(() => {
    if (!currentPageId) {
      return [];
    }

    const draft = draftsByPageId[currentPageId];
    return draft ? draft.layers : [];
  }, [currentPageId, draftsByPageId]);

  // Send layers to iframe whenever they change
  useEffect(() => {
    if (!iframeReady || !iframeRef.current) return;

    const serializedLayers = serializeLayers(layers);
    sendToIframe(iframeRef.current, {
      type: 'UPDATE_LAYERS',
      payload: {
        layers: serializedLayers,
        selectedLayerId,
      },
    });
  }, [layers, selectedLayerId, iframeReady]);

  // Send breakpoint updates to iframe
  useEffect(() => {
    if (!iframeReady || !iframeRef.current) return;

    sendToIframe(iframeRef.current, {
      type: 'UPDATE_BREAKPOINT',
      payload: { breakpoint: viewportMode },
    });
  }, [viewportMode, iframeReady]);

  // Listen for messages from iframe
  useEffect(() => {
    const handleIframeMessage = (message: IframeToParentMessage) => {
      console.log('[CenterCanvas] Received message from iframe:', message.type);

      switch (message.type) {
        case 'READY':
          console.log('[CenterCanvas] Iframe ready');
          setIframeReady(true);
          break;

        case 'LAYER_CLICK':
          console.log('[CenterCanvas] Layer clicked:', message.payload.layerId);
          setSelectedLayerId(message.payload.layerId);
          break;

        case 'LAYER_DOUBLE_CLICK':
          console.log('[CenterCanvas] Layer double-clicked:', message.payload.layerId);
          // Text editing is handled inside iframe
          break;

        case 'TEXT_CHANGE_START':
          console.log('[CenterCanvas] Text editing started:', message.payload.layerId);
          break;

        case 'TEXT_CHANGE_END':
          console.log('[CenterCanvas] Text changed:', message.payload);
          if (currentPageId) {
            updateLayer(currentPageId, message.payload.layerId, {
              text: message.payload.text,
              content: message.payload.text,
            });
          }
          break;

        case 'CONTEXT_MENU':
          console.log('[CenterCanvas] Context menu requested:', message.payload);
          // Context menu will be handled later
          break;

        case 'DRAG_START':
        case 'DRAG_OVER':
        case 'DROP':
          console.log('[CenterCanvas] Drag event:', message.type, message.payload);
          // Drag-and-drop will be handled later
          break;
      }
    };

    const cleanup = listenToIframe(handleIframeMessage);
    return cleanup;
  }, [currentPageId, setSelectedLayerId, updateLayer]);

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Breakpoint Controls */}
      <div className="flex items-center justify-center p-4 border-b bg-background">
        <Tabs value={viewportMode} onValueChange={(value) => setViewportMode(value as ViewportMode)}>
          <TabsList className="w-[240px]">
            <TabsTrigger value="desktop" title="Desktop View">
              Desktop
            </TabsTrigger>
            <TabsTrigger value="tablet" title="Tablet View">
              Tablet
            </TabsTrigger>
            <TabsTrigger value="mobile" title="Mobile View">
              Phone
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto bg-neutral-950/80">
        <div
          className="bg-white shadow-3xl transition-all origin-top"
          style={{
            transform: `scale(${zoom / 100})`,
            width: viewportSizes[viewportMode].width,
            minHeight: '800px',
          }}
        >
          {/* Iframe Canvas */}
          {layers.length > 0 ? (
            <iframe
              ref={iframeRef}
              src="/canvas.html"
              className="w-full h-full border-0"
              style={{ minHeight: '800px' }}
              title="Canvas Preview"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-12">
              <div className="text-center max-w-md relative">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                  <Icon name="layout" className="w-10 h-10 text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Start building
                </h2>
                <p className="text-gray-600 mb-8">
                  Add your first block to begin creating your page.
                </p>
                <div className="relative inline-block">
                  <Button
                    onClick={() => setShowAddBlockPanel(!showAddBlockPanel)}
                    size="lg"
                    className="gap-2"
                  >
                    <Icon name="plus" className="w-5 h-5" />
                    Add Block
                  </Button>

                  {/* Add Block Panel */}
                  {showAddBlockPanel && currentPageId && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl min-w-[240px]">
                      <div className="p-2">
                        <div className="text-xs text-gray-500 px-3 py-2 mb-1 font-medium">Choose a block</div>

                        <Button
                          onClick={() => {
                            // Always add inside Body container
                            addLayer(currentPageId, 'body', 'container');
                            setShowAddBlockPanel(false);
                          }}
                          variant="ghost"
                          className="w-full justify-start gap-3 px-3 py-3 h-auto"
                        >
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                            <Icon name="container" className="w-5 h-5 text-gray-700" />
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-semibold text-gray-900">Div</div>
                            <div className="text-xs text-gray-500">Container element</div>
                          </div>
                        </Button>

                        <Button
                          onClick={() => {
                            // Always add inside Body container
                            addLayer(currentPageId, 'body', 'heading');
                            setShowAddBlockPanel(false);
                          }}
                          variant="ghost"
                          className="w-full justify-start gap-3 px-3 py-3 h-auto"
                        >
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                            <Icon name="heading" className="w-5 h-5 text-gray-700" />
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-semibold text-gray-900">Heading</div>
                            <div className="text-xs text-gray-500">Title text</div>
                          </div>
                        </Button>

                        <Button
                          onClick={() => {
                            // Always add inside Body container
                            addLayer(currentPageId, 'body', 'text');
                            setShowAddBlockPanel(false);
                          }}
                          variant="ghost"
                          className="w-full justify-start gap-3 px-3 py-3 h-auto"
                        >
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                            <Icon name="type" className="w-5 h-5 text-gray-700" />
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-semibold text-gray-900">Paragraph</div>
                            <div className="text-xs text-gray-500">Body text</div>
                          </div>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

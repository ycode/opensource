'use client';

/**
 * Right Sidebar - Properties Panel
 * 
 * Shows properties for selected layer with Tailwind class editor
 */

import { useCallback, useMemo, useState } from 'react';
import { usePagesStore } from '../../../stores/usePagesStore';
import { useEditorStore } from '../../../stores/useEditorStore';
import type { Layer } from '../../../types';
import debounce from 'lodash.debounce';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface RightSidebarProps {
  selectedLayerId: string | null;
  onLayerUpdate: (layerId: string, updates: any) => void;
}

export default function RightSidebar({
  selectedLayerId,
  onLayerUpdate,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<'design' | 'settings' | 'content'>('design');
  const [classesInput, setClassesInput] = useState<string>('');

  const { currentPageId } = useEditorStore();
  const { draftsByPageId } = usePagesStore();

  const selectedLayer: Layer | null = useMemo(() => {
    if (! currentPageId || ! selectedLayerId) return null;
    const draft = draftsByPageId[currentPageId];
    if (! draft) return null;
    const stack: Layer[] = [...draft.layers];
    while (stack.length) {
      const node = stack.shift()!;
      if (node.id === selectedLayerId) return node;
      if (node.children) stack.push(...node.children);
    }
    return null;
  }, [currentPageId, selectedLayerId, draftsByPageId]);

  // Update local state when selected layer changes
  const [prevSelectedLayerId, setPrevSelectedLayerId] = useState<string | null>(null);
  if (selectedLayerId !== prevSelectedLayerId) {
    setPrevSelectedLayerId(selectedLayerId);
    setClassesInput(selectedLayer?.classes || '');
  }

  const debouncedUpdate = useMemo(
    () =>
      debounce((layerId: string, classes: string) => {
        onLayerUpdate(layerId, { classes });
      }, 500),
    [onLayerUpdate]
  );

  const handleClassesChange = (value: string) => {
    setClassesInput(value);
    if (selectedLayerId) {
      debouncedUpdate(selectedLayerId, value);
    }
  };

  const addClasses = (newClasses: string) => {
    if (!selectedLayerId) return;
    const currentClasses = classesInput;
    const updated = currentClasses + ' ' + newClasses;
    setClassesInput(updated.trim());
    onLayerUpdate(selectedLayerId, { classes: updated.trim() });
  };

  if (! selectedLayerId || ! selectedLayer) {
    return (
      <div className="w-72 bg-neutral-950 border-l border-white/10 flex items-center justify-center">
        <span className="text-xs text-white/50">Select layer</span>
      </div>
    );
  }

  return (
    <div className="w-72 bg-neutral-950 border-l border-white/10 flex flex-col p-4">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'design' | 'settings' | 'content')} className="flex flex-col flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Content */}
        <TabsContent value="design" className="flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden">{' '}
          <div className="p-4 space-y-6">
            {/* Tailwind Classes Editor */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Tailwind Classes
              </label>
              <textarea
                value={classesInput}
                onChange={(e) => handleClassesChange(e.target.value)}
                placeholder="flex gap-4 bg-blue-500 p-4 rounded"
                rows={4}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Type Tailwind classes separated by spaces
              </p>
            </div>

            {/* Quick Styles */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-3">
                Quick Styles
              </label>
              <div className="space-y-3">
                {/* Layout */}
                <div>
                  <div className="text-xs text-zinc-400 mb-2">Layout</div>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => addClasses('flex')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      Flex
                    </button>
                    <button 
                      onClick={() => addClasses('grid')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      Grid
                    </button>
                    <button 
                      onClick={() => addClasses('flex flex-col')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      Column
                    </button>
                    <button 
                      onClick={() => addClasses('flex items-center justify-center')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      Center
                    </button>
                  </div>
                </div>

                {/* Spacing */}
                <div>
                  <div className="text-xs text-zinc-400 mb-2">Spacing</div>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => addClasses('p-4')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      p-4
                    </button>
                    <button 
                      onClick={() => addClasses('p-8')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      p-8
                    </button>
                    <button 
                      onClick={() => addClasses('gap-4')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      gap-4
                    </button>
                    <button 
                      onClick={() => addClasses('m-4')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      m-4
                    </button>
                  </div>
                </div>

                {/* Colors */}
                <div>
                  <div className="text-xs text-zinc-400 mb-2">Background</div>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => addClasses('bg-white')}
                      className="w-8 h-8 bg-white rounded border border-zinc-700"
                      title="bg-white"
                    />
                    <button 
                      onClick={() => addClasses('bg-gray-50')}
                      className="w-8 h-8 bg-gray-50 rounded border border-zinc-700"
                      title="bg-gray-50"
                    />
                    <button 
                      onClick={() => addClasses('bg-blue-500')}
                      className="w-8 h-8 bg-blue-500 rounded border border-zinc-700"
                      title="bg-blue-500"
                    />
                    <button 
                      onClick={() => addClasses('bg-green-500')}
                      className="w-8 h-8 bg-green-500 rounded border border-zinc-700"
                      title="bg-green-500"
                    />
                    <button 
                      onClick={() => addClasses('bg-red-500')}
                      className="w-8 h-8 bg-red-500 rounded border border-zinc-700"
                      title="bg-red-500"
                    />
                    <button 
                      onClick={() => addClasses('bg-purple-500')}
                      className="w-8 h-8 bg-purple-500 rounded border border-zinc-700"
                      title="bg-purple-500"
                    />
                  </div>
                </div>

                {/* Text */}
                <div>
                  <div className="text-xs text-zinc-400 mb-2">Text</div>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => addClasses('text-sm')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      Small
                    </button>
                    <button 
                      onClick={() => addClasses('text-lg')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      Large
                    </button>
                    <button 
                      onClick={() => addClasses('font-bold')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      Bold
                    </button>
                    <button 
                      onClick={() => addClasses('text-center')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      Center
                    </button>
                  </div>
                </div>

                {/* Effects */}
                <div>
                  <div className="text-xs text-zinc-400 mb-2">Effects</div>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => addClasses('rounded')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      Rounded
                    </button>
                    <button 
                      onClick={() => addClasses('rounded-lg')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      Rounded-lg
                    </button>
                    <button 
                      onClick={() => addClasses('shadow-lg')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      Shadow
                    </button>
                    <button 
                      onClick={() => addClasses('border border-gray-300')}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300"
                    >
                      Border
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </TabsContent>

        <TabsContent value="content" className="flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden">
          <div className="p-4 space-y-4">
            {selectedLayer.type === 'text' || selectedLayer.type === 'heading' ? (
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Text Content
                </label>
                <textarea
                  value={selectedLayer.content || ''}
                  onChange={(e) => {
                    if (selectedLayerId) {
                      onLayerUpdate(selectedLayerId, { content: e.target.value });
                    }
                  }}
                  placeholder="Enter text..."
                  rows={6}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Or double-click the layer in the canvas to edit inline
                </p>
              </div>
            ) : selectedLayer.type === 'image' ? (
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Image Source
                </label>
                <input
                  type="text"
                  value={selectedLayer.src || ''}
                  onChange={(e) => {
                    if (selectedLayerId) {
                      onLayerUpdate(selectedLayerId, { src: e.target.value });
                    }
                  }}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-zinc-500 mt-2">
                  Or use the Assets tab to upload an image
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <p className="text-sm">No editable content for this layer type</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Layer ID
              </label>
              <input
                type="text"
                value={selectedLayer.id}
                readOnly
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-500 text-xs font-mono"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden">
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Layer Type
              </label>
              <input
                type="text"
                value={selectedLayer.type}
                readOnly
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 text-sm capitalize"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Has Children
              </label>
              <input
                type="text"
                value={selectedLayer.children ? `Yes (${selectedLayer.children.length})` : 'No'}
                readOnly
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 text-sm"
              />
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <button
                onClick={() => {
                  if (selectedLayerId && currentPageId) {
                    const { deleteLayer } = usePagesStore.getState();
                    deleteLayer(currentPageId, selectedLayerId);
                  }
                }}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
              >
                Delete Layer
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

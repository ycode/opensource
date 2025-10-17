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
      <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex items-center justify-center">
        <div className="text-center text-zinc-500">
          <svg className="w-12 h-12 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm">Select a layer to edit properties</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col">
      {/* Header */}
      <div className="border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-zinc-300">Properties</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                if (selectedLayerId && currentPageId) {
                  const { deleteLayer } = usePagesStore.getState();
                  deleteLayer(currentPageId, selectedLayerId);
                }
              }}
              className="p-1.5 hover:bg-zinc-800 rounded text-red-400 hover:text-red-300"
              title="Delete layer"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        <div className="text-xs text-zinc-500">
          {selectedLayer.type.charAt(0).toUpperCase() + selectedLayer.type.slice(1)} Layer
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('design')}
          className={`flex-1 px-4 py-3 text-sm font-medium ${
            activeTab === 'design'
              ? 'text-white border-b-2 border-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Design
        </button>
        <button
          onClick={() => setActiveTab('content')}
          className={`flex-1 px-4 py-3 text-sm font-medium ${
            activeTab === 'content'
              ? 'text-white border-b-2 border-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Content
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 px-4 py-3 text-sm font-medium ${
            activeTab === 'settings'
              ? 'text-white border-b-2 border-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Settings
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'design' && (
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
        )}

        {activeTab === 'content' && (
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
        )}

        {activeTab === 'settings' && (
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
        )}
      </div>
    </div>
  );
}

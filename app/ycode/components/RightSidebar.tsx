'use client';

/**
 * Right Sidebar - Properties Panel
 * 
 * Shows properties for selected layer with Tailwind class editor
 */

import { useCallback, useMemo, useState } from 'react';
import { usePagesStore } from '../../../stores/usePagesStore';
import { useEditorStore } from '../../../stores/useEditorStore';
import { useLayerLocks } from '../../../hooks/use-layer-locks';
import type { Layer } from '../../../types';
import debounce from 'lodash.debounce';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { X } from 'lucide-react';
import {Input} from "@/components/ui/input";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import Icon from "@/components/ui/icon";

interface RightSidebarProps {
  selectedLayerId: string | null;
  onLayerUpdate: (layerId: string, updates: any) => void;
  onLayerDeselect?: () => void;
}

export default function RightSidebar({
  selectedLayerId,
  onLayerUpdate,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<'design' | 'settings' | 'content'>('design');
  const [classesInput, setClassesInput] = useState<string>('');
  const [currentClassInput, setCurrentClassInput] = useState<string>('');

  const { currentPageId } = useEditorStore();
  const { draftsByPageId } = usePagesStore();
  const layerLocks = useLayerLocks();

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

  // Check if the selected layer is locked by another user
  const isLayerLocked = selectedLayerId ? layerLocks.isLayerLocked(selectedLayerId) : false;
  const canEditLayer = selectedLayerId ? layerLocks.canEditLayer(selectedLayerId) : false;
  const isLockedByOther = isLayerLocked && !canEditLayer;

  // Update local state when selected layer changes
  const [prevSelectedLayerId, setPrevSelectedLayerId] = useState<string | null>(null);
  if (selectedLayerId !== prevSelectedLayerId) {
    setPrevSelectedLayerId(selectedLayerId);
    setClassesInput(selectedLayer?.classes || '');
  }

  // Lock-aware update function
  const handleLayerUpdate = useCallback((layerId: string, updates: any) => {
    if (isLockedByOther) {
      console.warn(`Cannot update layer ${layerId} - it is locked by another user`);
      return;
    }
    onLayerUpdate(layerId, updates);
  }, [onLayerUpdate, isLockedByOther]);

  // Parse classes into array for badge display
  const classesArray = useMemo(() => {
    return classesInput.split(' ').filter(cls => cls.trim() !== '');
  }, [classesInput]);

  // Add a new class
  const addClass = useCallback((newClass: string) => {
    if (!newClass.trim()) return;
    
    const trimmedClass = newClass.trim();
    if (classesArray.includes(trimmedClass)) return; // Don't add duplicates
    
    const newClasses = [...classesArray, trimmedClass].join(' ');
    setClassesInput(newClasses);
    handleClassesChange(newClasses);
    setCurrentClassInput('');
  }, [classesArray]);

  // Remove a class
  const removeClass = useCallback((classToRemove: string) => {
    const newClasses = classesArray.filter(cls => cls !== classToRemove).join(' ');
    setClassesInput(newClasses);
    handleClassesChange(newClasses);
  }, [classesArray]);

  // Handle Enter key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addClass(currentClassInput);
    }
  }, [currentClassInput, addClass]);

  const debouncedUpdate = useMemo(
    () =>
      debounce((layerId: string, classes: string) => {
        handleLayerUpdate(layerId, { classes });
      }, 500),
    [handleLayerUpdate]
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
    handleLayerUpdate(selectedLayerId, { classes: updated.trim() });
  };

  // Helper function for button props when layer is locked
  const getButtonProps = (onClick: () => void) => ({
    onClick,
    disabled: isLockedByOther,
    className: `px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 text-zinc-300 ${
      isLockedByOther ? 'opacity-50 cursor-not-allowed' : ''
    }`
  });

  if (! selectedLayerId || ! selectedLayer) {
    return (
      <div className="w-72 shrink-0 bg-neutral-950 border-l border-white/10 flex items-center justify-center">
        <span className="text-xs text-white/50">Select layer</span>
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0 bg-neutral-950 border-l border-white/10 flex flex-col">
      {/* Header */}
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-white">Properties</h3>
          <div className="flex items-center gap-2">
            {/* Lock indicator */}
            {isLockedByOther && (
              <div className="flex items-center gap-1 text-amber-400 text-xs">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span>Locked</span>
              </div>
            )}
            <button 
              onClick={() => {
                if (selectedLayerId && currentPageId) {
                  const { deleteLayer } = usePagesStore.getState();
                  deleteLayer(currentPageId, selectedLayerId);
                }
              }}
              className="p-1.5 hover:bg-white/10 rounded text-red-400 hover:text-red-300"
              title="Delete layer"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        <div className="text-xs text-white/60">
          {selectedLayer.type.charAt(0).toUpperCase() + selectedLayer.type.slice(1)} Layer
        </div>
      </div>
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'design' | 'settings' | 'content')} className="flex flex-col flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Content */}
        <TabsContent value="design" className="flex-1 flex flex-col overflow-y-auto data-[state=inactive]:hidden">
          <div className="flex flex-col gap-4 p-4">
            <Input
              type="text"
              value={currentClassInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentClassInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type class and press Enter..."
              disabled={isLockedByOther}
              className={isLockedByOther ? 'opacity-50 cursor-not-allowed' : ''}
            />
            <div className="flex flex-wrap gap-1.5">
                {classesArray.length === 0 ? (
                    <div></div>
                ) : (
                  classesArray.map((cls, index) => (
                    <Badge
                      variant="secondary"
                      key={index}
                    >
                      <span>{cls}</span>
                      <Button 
                        onClick={() => removeClass(cls)} 
                        className="!size-4 !p-0 -mr-1" 
                        variant="outline"
                        disabled={isLockedByOther}
                      >
                        <Icon name="house" className="size-2"/>
                      </Button>
                    </Badge>
                  ))
                )}
              </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden">
          <div className="p-4 space-y-4">
            {selectedLayer.type === 'text' || selectedLayer.type === 'heading' ? (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Text Content
                </label>
                <textarea
                  value={selectedLayer.content || ''}
                  onChange={(e) => {
                    if (selectedLayerId) {
                      handleLayerUpdate(selectedLayerId, { content: e.target.value });
                    }
                  }}
                  placeholder="Enter text..."
                  rows={6}
                  disabled={isLockedByOther}
                  className={`w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white text-sm placeholder-neutral-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isLockedByOther ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                />
                <p className="text-xs text-white/60 mt-1">
                  Or double-click the layer in the canvas to edit inline
                </p>
              </div>
            ) : selectedLayer.type === 'image' ? (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Image Source
                </label>
                <input
                  type="text"
                  value={selectedLayer.src || ''}
                  onChange={(e) => {
                    if (selectedLayerId) {
                      handleLayerUpdate(selectedLayerId, { src: e.target.value });
                    }
                  }}
                  placeholder="https://example.com/image.jpg"
                  disabled={isLockedByOther}
                  className={`w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white text-sm placeholder-neutral-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isLockedByOther ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                />
                <p className="text-xs text-white/60 mt-2">
                  Or use the Assets tab to upload an image
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-white/60">
                <p className="text-sm">No editable content for this layer type</p>
              </div>
            )}

        </TabsContent>
      </Tabs>
    </div>
  );
}

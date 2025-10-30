'use client';

<<<<<<< HEAD
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useEditorStore } from '../../../stores/useEditorStore';
import { usePagesStore } from '../../../stores/usePagesStore';
import { useLayerLocks } from '../../../hooks/use-layer-locks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {Input} from "@/components/ui/input";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import Icon from "@/components/ui/icon";
=======
/**
 * Right Sidebar - Properties Panel
 * 
 * Shows properties for selected layer with Tailwind class editor
 */

// 1. React/Next.js
import { useCallback, useMemo, useState } from 'react';

// 2. External libraries
import debounce from 'lodash.debounce';
import { X } from 'lucide-react';

// 3. ShadCN UI
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// 4. Internal components
import BorderControls from './BorderControls';
import EffectControls from './EffectControls';
import LayoutControls from './LayoutControls';
import SettingsPanel from './SettingsPanel';
import ToggleGroup from './ToggleGroup';
import TypographyControls from './TypographyControls';

// 5. Stores
import { useEditorStore } from '../../../stores/useEditorStore';
import { usePagesStore } from '../../../stores/usePagesStore';

// 6. Types
>>>>>>> main
import type { Layer } from '../../../types';

interface RightSidebarProps {
  selectedLayerId: string | null;
<<<<<<< HEAD
  onLayerUpdate: (layerId: string, updates: any) => void;
  onLayerDeselect?: () => void;
  liveLayerUpdates?: {
    broadcastLayerDelete: (pageId: string, layerId: string) => void;
  };
  currentPageId?: string | null;
=======
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
>>>>>>> main
}

export default function RightSidebar({
  selectedLayerId,
  onLayerUpdate,
  liveLayerUpdates,
  currentPageId,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<'design' | 'settings' | 'content'>('design');
  const [classesInput, setClassesInput] = useState<string>('');
  const [currentClassInput, setCurrentClassInput] = useState<string>('');
  const [attributesOpen, setAttributesOpen] = useState(true);
  const [customId, setCustomId] = useState<string>('');
  const [isHidden, setIsHidden] = useState<boolean>(false);

  const { currentPageId: editorCurrentPageId } = useEditorStore();
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
    const classes = selectedLayer?.classes || '';
    setClassesInput(Array.isArray(classes) ? classes.join(' ') : classes);
    setCustomId(selectedLayer?.attributes?.id || '');
    setIsHidden(selectedLayer?.hidden || false);
  }

  // Lock-aware update function
  const handleLayerUpdate = useCallback((layerId: string, updates: any) => {
    if (isLockedByOther) {
      console.warn('Cannot update layer - locked by another user');
      return;
    }
    onLayerUpdate(layerId, updates);
  }, [isLockedByOther, onLayerUpdate]);

  // Debounced update function
  const debouncedUpdate = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (layerId: string, updates: any) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          handleLayerUpdate(layerId, updates);
        }, 500);
      };
    })(),
    [handleLayerUpdate]
  );

  // Parse classes into array
  const classesArray = useMemo(() => {
    return classesInput.split(' ').filter(cls => cls.trim() !== '');
  }, [classesInput]);

  // Handle classes change
  const handleClassesChange = useCallback((newClasses: string) => {
    setClassesInput(newClasses);
    if (selectedLayerId) {
      debouncedUpdate(selectedLayerId, { classes: newClasses });
    }
  }, [selectedLayerId, debouncedUpdate]);

  // Add class function
  const addClass = useCallback((newClass: string) => {
    if (!newClass.trim()) return;
    setClassesInput(prev => {
      const currentClasses = prev.split(' ').filter(cls => cls.trim() !== '');
      const updatedClasses = [...currentClasses, newClass.trim()].join(' ');
      if (selectedLayerId) {
        debouncedUpdate(selectedLayerId, { classes: updatedClasses });
      }
      return updatedClasses;
    });
    setCurrentClassInput('');
  }, [selectedLayerId, debouncedUpdate]);

  // Remove class function
  const removeClass = useCallback((classToRemove: string) => {
    setClassesInput(prev => {
      const currentClasses = prev.split(' ').filter(cls => cls.trim() !== '');
      const updatedClasses = currentClasses.filter(cls => cls !== classToRemove).join(' ');
      if (selectedLayerId) {
        debouncedUpdate(selectedLayerId, { classes: updatedClasses });
      }
      return updatedClasses;
    });
  }, [selectedLayerId, debouncedUpdate]);

  // Handle key press for adding classes
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addClass(currentClassInput);
    }
  }, [addClass, currentClassInput]);

  // Add classes function
  const addClasses = useCallback((classes: string[]) => {
    setClassesInput(prev => {
      const currentClasses = prev.split(' ').filter(cls => cls.trim() !== '');
      const updatedClasses = [...currentClasses, ...classes].join(' ');
      if (selectedLayerId) {
        handleLayerUpdate(selectedLayerId, { classes: updatedClasses });
      }
      return updatedClasses;
    });
  }, [selectedLayerId, handleLayerUpdate]);

  // Quick style buttons
  const quickStyles = [
    { label: 'Flex', classes: ['flex'] },
    { label: 'Grid', classes: ['grid'] },
    { label: 'Column', classes: ['flex-col'] },
    { label: 'Center', classes: ['items-center', 'justify-center'] },
    { label: 'Space Between', classes: ['justify-between'] },
    { label: 'Gap', classes: ['gap-4'] },
    { label: 'Padding', classes: ['p-4'] },
    { label: 'Margin', classes: ['m-4'] },
    { label: 'Border', classes: ['border', 'border-gray-300'] },
    { label: 'Rounded', classes: ['rounded'] },
  ];

  // Get button props for quick style buttons
  const getButtonProps = (classes: string[]) => ({
    disabled: isLockedByOther,
    className: isLockedByOther ? 'opacity-50 cursor-not-allowed' : '',
    onClick: () => addClasses(classes)
  });

<<<<<<< HEAD
  if (!selectedLayer) {
=======
  // Handle custom ID change
  const handleIdChange = (value: string) => {
    setCustomId(value);
    if (selectedLayerId) {
      const currentAttributes = selectedLayer?.attributes || {};
      onLayerUpdate(selectedLayerId, {
        attributes: { ...currentAttributes, id: value }
      });
    }
  };

  // Handle visibility toggle
  const handleVisibilityChange = (hidden: boolean) => {
    setIsHidden(hidden);
    if (selectedLayerId) {
      onLayerUpdate(selectedLayerId, { hidden });
    }
  };

  if (! selectedLayerId || ! selectedLayer) {
>>>>>>> main
    return (
      <div className="w-72 shrink-0 bg-neutral-950 border-l border-white/10 flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <div className="w-12 h-12 bg-neutral-800 rounded-lg flex items-center justify-center mb-4 mx-auto">
            <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-white mb-1">No Layer Selected</h3>
          <span className="text-xs text-white/50">Select layer</span>
        </div>
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
                  // Broadcast the layer deletion to other users
                  if (liveLayerUpdates) {
                    liveLayerUpdates.broadcastLayerDelete(currentPageId, selectedLayerId);
                  }
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
      <Tabs
        value={activeTab} onValueChange={(value) => setActiveTab(value as 'design' | 'settings' | 'content')}
        className="flex flex-col flex-1 gap-0"
      >
        <TabsList className="w-full">
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <hr className="mt-4" />

        {/* Content */}
<<<<<<< HEAD
        <TabsContent value="design" className="flex-1 flex flex-col overflow-y-auto data-[state=inactive]:hidden">
          <div className="flex flex-col gap-4 p-4">
=======
        <TabsContent value="design" className="flex-1 flex flex-col divide-y overflow-y-auto data-[state=inactive]:hidden overflow-x-hidden">

          <LayoutControls />

          <TypographyControls />

          <BorderControls />

          <EffectControls />

          <div className="flex flex-col gap-4 py-5">
>>>>>>> main
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
<<<<<<< HEAD
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
                        <Icon name="x" className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))
                )}
            </div>

            {/* Quick Style Buttons */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-white/70 uppercase tracking-wide">Quick Styles</label>
              <div className="grid grid-cols-2 gap-2">
                {quickStyles.map((style, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    {...getButtonProps(style.classes)}
                  >
                    {style.label}
                  </Button>
                ))}
              </div>
=======
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
                          onClick={() => removeClass(cls)} className="!size-4 !p-0 -mr-1"
                          variant="outline"
                        >
                          <Icon name="x" className="size-2" />
                        </Button>
                      </Badge>
                ))
              )}
>>>>>>> main
            </div>
          </div>

        </TabsContent>

<<<<<<< HEAD
        <TabsContent value="settings" className="flex-1 flex flex-col overflow-y-auto data-[state=inactive]:hidden">
          <div className="flex flex-col gap-4 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Layer Type</label>
              <div className="text-sm text-white/60">
                {selectedLayer.type.charAt(0).toUpperCase() + selectedLayer.type.slice(1)}
              </div>
            </div>
            
            {selectedLayer.type === 'text' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Text Content</label>
                <textarea
                  value={selectedLayer.content || ''}
                  onChange={(e) => selectedLayerId && handleLayerUpdate(selectedLayerId, { content: e.target.value })}
                  className="w-full p-2 bg-neutral-800 border border-white/10 rounded text-white placeholder-white/50 resize-none"
                  placeholder="Enter text content..."
                  rows={3}
                  disabled={isLockedByOther}
                  style={{ opacity: isLockedByOther ? 0.5 : 1, cursor: isLockedByOther ? 'not-allowed' : 'text' }}
                />
              </div>
            )}
            
            {selectedLayer.type === 'image' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Image Source</label>
                <input
                  type="text"
                  value={selectedLayer.src || ''}
                  onChange={(e) => selectedLayerId && handleLayerUpdate(selectedLayerId, { src: e.target.value })}
                  className="w-full p-2 bg-neutral-800 border border-white/10 rounded text-white placeholder-white/50"
                  placeholder="Enter image URL..."
                  disabled={isLockedByOther}
                  style={{ opacity: isLockedByOther ? 0.5 : 1, cursor: isLockedByOther ? 'not-allowed' : 'text' }}
                />
              </div>
            )}
=======
        <TabsContent value="settings" className="flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden">
          <div className="flex flex-col gap-4 p-2">
            {/* Attributes Panel */}
            <SettingsPanel
              title="Attributes"
              isOpen={attributesOpen}
              onToggle={() => setAttributesOpen(!attributesOpen)}
            >
              {/* ID Field */}
              <div>
                <label className="block text-xs text-zinc-400 mb-2">ID</label>
                <Input
                  type="text"
                  value={customId}
                  onChange={(e) => handleIdChange(e.target.value)}
                  placeholder="Identifier"
                  className="w-full bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
                />
              </div>

              {/* Element Visibility Toggle */}
              <div>
                <label className="block text-xs text-zinc-400 mb-2">Element</label>
                <ToggleGroup
                  options={[
                    { label: 'Shown', value: false },
                    { label: 'Hidden', value: true },
                  ]}
                  value={isHidden}
                  onChange={(value) => handleVisibilityChange(value as boolean)}
                />
              </div>
            </SettingsPanel>
>>>>>>> main
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
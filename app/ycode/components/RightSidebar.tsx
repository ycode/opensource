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
import { X } from 'lucide-react';
import {Input} from "@/components/ui/input";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import SettingsPanel from './SettingsPanel';
import ToggleGroup from './ToggleGroup';

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
  const [currentClassInput, setCurrentClassInput] = useState<string>('');
  const [attributesOpen, setAttributesOpen] = useState(true);
  const [customId, setCustomId] = useState<string>('');
  const [isHidden, setIsHidden] = useState<boolean>(false);

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
    setCustomId(selectedLayer?.attributes?.id || '');
    setIsHidden(selectedLayer?.hidden || false);
  }

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
    return (
      <div className="w-72 shrink-0 bg-neutral-950 border-l border-white/10 flex items-center justify-center">
        <span className="text-xs text-white/50">Select layer</span>
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0 bg-neutral-950 border-l border-white/10 flex flex-col p-4">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'design' | 'settings' | 'content')} className="flex flex-col flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <hr className="my-2"/>

        {/* Content */}
        <TabsContent value="design" className="flex-1 flex flex-col overflow-y-auto data-[state=inactive]:hidden">
          <div className="flex flex-col gap-4">
            <Input
              type="text"
              value={currentClassInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentClassInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type class and press Enter..."
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
                      <Button onClick={() => removeClass(cls)} className="!size-4 !p-0 -mr-1" variant="outline">
                        <Icon name="x" className="size-2"/>
                      </Button>
                    </Badge>
                  ))
                )}
              </div>
          </div>
        </TabsContent>

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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

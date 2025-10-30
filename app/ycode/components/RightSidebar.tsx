'use client';

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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import type { Layer } from '../../../types';

interface RightSidebarProps {
  selectedLayerId: string | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
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
  const [headingTag, setHeadingTag] = useState<string>('h1');
  const [containerTag, setContainerTag] = useState<string>('div');

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

  // Helper function to check if layer is a heading
  const isHeadingLayer = (layer: Layer | null): boolean => {
    if (!layer) return false;
    const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'heading'];
    return headingTags.includes(layer.type || '') || 
           headingTags.includes(layer.name || '') ||
           headingTags.includes(layer.settings?.tag || '');
  };

  // Helper function to check if layer is a container/section/block
  const isContainerLayer = (layer: Layer | null): boolean => {
    if (!layer) return false;
    const containerTags = [
      'div', 'container', 'section', 'nav', 'main', 'aside', 
      'header', 'footer', 'article', 'figure', 'figcaption',
      'details', 'summary'
    ];
    return containerTags.includes(layer.type || '') || 
           containerTags.includes(layer.name || '') ||
           containerTags.includes(layer.settings?.tag || '');
  };

  // Get default heading tag based on layer type/name
  const getDefaultHeadingTag = (layer: Layer | null): string => {
    if (!layer) return 'h1';
    if (layer.settings?.tag) return layer.settings.tag;
    if (layer.name && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(layer.name)) {
      return layer.name;
    }
    return 'h1'; // Default to h1
  };

  // Get default container tag based on layer type/name
  const getDefaultContainerTag = (layer: Layer | null): string => {
    if (!layer) return 'div';
    if (layer.settings?.tag) return layer.settings.tag;
    
    // Check if layer.name is already a valid semantic tag
    if (layer.name && ['div', 'section', 'nav', 'main', 'aside', 'header', 'footer', 'article', 'figure', 'figcaption', 'details', 'summary'].includes(layer.name)) {
      return layer.name;
    }
    
    // Map element types to their default tags:
    // Section = section, Container = div, Block = div
    if (layer.type === 'section' || layer.name === 'section') return 'section';
    if (layer.type === 'container' || layer.name === 'container') return 'div';
    
    return 'div'; // Default fallback
  };

  // Update local state when selected layer changes
  const [prevSelectedLayerId, setPrevSelectedLayerId] = useState<string | null>(null);
  if (selectedLayerId !== prevSelectedLayerId) {
    setPrevSelectedLayerId(selectedLayerId);
    const classes = selectedLayer?.classes || '';
    setClassesInput(Array.isArray(classes) ? classes.join(' ') : classes);
    setCustomId(selectedLayer?.settings?.id || '');
    setIsHidden(selectedLayer?.settings?.hidden || false);
    setHeadingTag(selectedLayer?.settings?.tag || getDefaultHeadingTag(selectedLayer));
    setContainerTag(selectedLayer?.settings?.tag || getDefaultContainerTag(selectedLayer));
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
      const currentSettings = selectedLayer?.settings || {};
      onLayerUpdate(selectedLayerId, {
        settings: { ...currentSettings, id: value }
      });
    }
  };

  // Handle visibility toggle
  const handleVisibilityChange = (hidden: boolean) => {
    setIsHidden(hidden);
    if (selectedLayerId) {
      const currentSettings = selectedLayer?.settings || {};
      onLayerUpdate(selectedLayerId, { 
        settings: { ...currentSettings, hidden }
      });
    }
  };

  // Handle heading tag change
  const handleHeadingTagChange = (tag: string) => {
    setHeadingTag(tag);
    if (selectedLayerId) {
      const currentSettings = selectedLayer?.settings || {};
      onLayerUpdate(selectedLayerId, { 
        settings: { ...currentSettings, tag }
      });
    }
  };

  // Handle container tag change
  const handleContainerTagChange = (tag: string) => {
    setContainerTag(tag);
    if (selectedLayerId) {
      const currentSettings = selectedLayer?.settings || {};
      onLayerUpdate(selectedLayerId, { 
        settings: { ...currentSettings, tag }
      });
    }
  };

  if (! selectedLayerId || ! selectedLayer) {
    return (
      <div className="w-64 shrink-0 bg-neutral-950 border-l border-white/10 flex items-center justify-center">
        <span className="text-xs text-white/50">Select layer</span>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 bg-neutral-950 border-l border-white/10 flex flex-col p-4">
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
        <TabsContent value="design" className="flex-1 flex flex-col divide-y overflow-y-auto data-[state=inactive]:hidden overflow-x-hidden">

          <LayoutControls />

          <TypographyControls />

          <BorderControls />

          <EffectControls />

          <div className="flex flex-col gap-4 py-5">
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
                        <Button
                          onClick={() => removeClass(cls)} className="!size-4 !p-0 -mr-1"
                          variant="outline"
                        >
                          <Icon name="x" className="size-2" />
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

              {/* Heading Tag Selector - Only for headings */}
              {isHeadingLayer(selectedLayer) && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Tag</label>
                  <ToggleGroup
                    options={[
                      { label: 'H1', value: 'h1' },
                      { label: 'H2', value: 'h2' },
                      { label: 'H3', value: 'h3' },
                      { label: 'H4', value: 'h4' },
                      { label: 'H5', value: 'h5' },
                      { label: 'H6', value: 'h6' },
                    ]}
                    value={headingTag}
                    onChange={(value) => handleHeadingTagChange(value as string)}
                  />
                </div>
              )}

              {/* Container Tag Selector - Only for containers/sections/blocks */}
              {isContainerLayer(selectedLayer) && !isHeadingLayer(selectedLayer) && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Tag</label>
                  <Select value={containerTag} onValueChange={handleContainerTagChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="div">Div</SelectItem>
                        <SelectItem value="nav">Nav</SelectItem>
                        <SelectItem value="main">Main</SelectItem>
                        <SelectItem value="aside">Aside</SelectItem>
                        <SelectItem value="header">Header</SelectItem>
                        <SelectItem value="figure">Figure</SelectItem>
                        <SelectItem value="footer">Footer</SelectItem>
                        <SelectItem value="article">Article</SelectItem>
                        <SelectItem value="section">Section</SelectItem>
                        <SelectItem value="figcaption">Figcaption</SelectItem>
                        <SelectItem value="details">Details</SelectItem>
                        <SelectItem value="summary">Summary</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </SettingsPanel>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

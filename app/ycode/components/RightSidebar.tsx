'use client';

/**
 * Right Sidebar - Properties Panel
 *
 * Shows properties for selected layer with Tailwind class editor
 */

// 1. React/Next.js
import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';

// 2. External libraries
import debounce from 'lodash.debounce';

// 3. ShadCN UI
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectLabel, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// 4. Internal components
import AddAttributeModal from './AddAttributeModal';
import BackgroundsControls from './BackgroundsControls';
import BorderControls from './BorderControls';
import EffectControls from './EffectControls';
import ConditionalVisibilitySettings from './ConditionalVisibilitySettings';
import ImageSettings from './ImageSettings';
import InputWithInlineVariables from './InputWithInlineVariables';
import InteractionsPanel from './InteractionsPanel';
import LayoutControls from './LayoutControls';
import LayerStylesPanel from './LayerStylesPanel';
import PositionControls from './PositionControls';
import SettingsPanel from './SettingsPanel';
import SizingControls from './SizingControls';
import SpacingControls from './SpacingControls';
import ToggleGroup from './ToggleGroup';
import TypographyControls from './TypographyControls';
import UIStateSelector from './UIStateSelector';

// 5. Stores
import { useEditorStore } from '@/stores/useEditorStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useEditorActions, useEditorUrl } from '@/hooks/use-editor-url';

// 6. Utils, APIs, lib
import { classesToDesign, mergeDesign, removeConflictsForClass } from '@/lib/tailwind-class-mapper';
import { cn } from '@/lib/utils';
import { isFieldVariable, getCollectionVariable, findParentCollectionLayer, isTextEditable } from '@/lib/layer-utils';
import { convertContentToValue, parseValueToContent } from '@/lib/cms-variables-utils';

// 7. Types
import type { Layer, FieldVariable } from '@/types';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import {
  DropdownMenu,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

interface RightSidebarProps {
  selectedLayerId: string | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

const RightSidebar = React.memo(function RightSidebar({
  selectedLayerId,
  onLayerUpdate,
}: RightSidebarProps) {
  const { openComponent, urlState, updateQueryParams } = useEditorActions();
  const { routeType } = useEditorUrl();

  // Local state for immediate UI feedback
  const [activeTab, setActiveTab] = useState<'design' | 'settings' | 'interactions'>(
    urlState.rightTab || 'design'
  );

  // Track last user-initiated change to prevent URL→state sync loops
  const lastUserChangeRef = useRef<number>(0);

  // Handle tab change: optimistic UI update + background URL sync
  const handleTabChange = useCallback((value: string) => {
    const newTab = value as 'design' | 'settings' | 'interactions';

    // Immediate UI update
    setActiveTab(newTab);

    // Mark as user-initiated (prevents URL→state sync for 100ms)
    lastUserChangeRef.current = Date.now();

    // Background URL update
    if (routeType === 'page' || routeType === 'layers' || routeType === 'component') {
      updateQueryParams({ tab: newTab });
    }
  }, [routeType, updateQueryParams]);

  // Sync URL→state only for external navigation (back/forward, direct URL)
  useEffect(() => {
    // Skip if this was a recent user-initiated change (within 100ms)
    if (Date.now() - lastUserChangeRef.current < 100) {
      return;
    }

    const urlTab = urlState.rightTab || 'design';
    if (urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [urlState.rightTab]);

  const [currentClassInput, setCurrentClassInput] = useState<string>('');
  const [attributesOpen, setAttributesOpen] = useState(true);
  const [customId, setCustomId] = useState<string>('');
  const [isHidden, setIsHidden] = useState<boolean>(false);
  const [headingTag, setHeadingTag] = useState<string>('h1');
  const [containerTag, setContainerTag] = useState<string>('div');
  const [customAttributesOpen, setCustomAttributesOpen] = useState(true);
  const [showAddAttributePopover, setShowAddAttributePopover] = useState(false);
  const [newAttributeName, setNewAttributeName] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [classesOpen, setClassesOpen] = useState(true);
  const [collectionBindingOpen, setCollectionBindingOpen] = useState(true);
  const [fieldBindingOpen, setFieldBindingOpen] = useState(true);
  const [contentOpen, setContentOpen] = useState(true);
  const [interactionOwnerLayerId, setInteractionOwnerLayerId] = useState<string | null>(null);
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [interactionResetKey, setInteractionResetKey] = useState(0);

  // Optimize store subscriptions - use selective selectors
  const currentPageId = useEditorStore((state) => state.currentPageId);
  const activeBreakpoint = useEditorStore((state) => state.activeBreakpoint);
  const editingComponentId = useEditorStore((state) => state.editingComponentId);
  const setSelectedLayerId = useEditorStore((state) => state.setSelectedLayerId);
  const setInteractionHighlights = useEditorStore((state) => state.setInteractionHighlights);
  const setActiveInteraction = useEditorStore((state) => state.setActiveInteraction);
  const clearActiveInteraction = useEditorStore((state) => state.clearActiveInteraction);

  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);
  const pages = usePagesStore((state) => state.pages);

  const getComponentById = useComponentsStore((state) => state.getComponentById);
  const componentDrafts = useComponentsStore((state) => state.componentDrafts);

  const collections = useCollectionsStore((state) => state.collections);
  const fields = useCollectionsStore((state) => state.fields);

  // Get all layers (for interactions target selection)
  const allLayers: Layer[] = useMemo(() => {
    if (editingComponentId) {
      return componentDrafts[editingComponentId] || [];
    } else if (currentPageId) {
      const draft = draftsByPageId[currentPageId];
      return draft ? draft.layers : [];
    }
    return [];
  }, [editingComponentId, componentDrafts, currentPageId, draftsByPageId]);

  // Helper to find layer by ID
  const findLayerById = useCallback((layerId: string | null): Layer | null => {
    if (!layerId || !allLayers.length) return null;

    const stack: Layer[] = [...allLayers];
    while (stack.length) {
      const node = stack.shift()!;
      if (node.id === layerId) return node;
      if (node.children) stack.push(...node.children);
    }
    return null;
  }, [allLayers]);

  const selectedLayer: Layer | null = useMemo(() => {
    return findLayerById(selectedLayerId);
  }, [selectedLayerId, findLayerById]);

  // Get the layer whose interactions we're editing (different from selected layer during target selection)
  const interactionOwnerLayer: Layer | null = useMemo(() => {
    return findLayerById(interactionOwnerLayerId);
  }, [interactionOwnerLayerId, findLayerById]);

  // Set interaction owner when interactions tab becomes active
  useEffect(() => {
    if (activeTab === 'interactions' && selectedLayerId && !interactionOwnerLayerId) {
      setInteractionOwnerLayerId(selectedLayerId);
    }
  }, [activeTab, selectedLayerId, interactionOwnerLayerId]);

  // Update interaction owner layer when selected layer changes (only if no trigger is selected)
  useEffect(() => {
    if (activeTab === 'interactions' && selectedLayerId && !selectedTriggerId) {
      setInteractionOwnerLayerId(selectedLayerId);
    }
  }, [activeTab, selectedLayerId, selectedTriggerId]);

  // Clear interaction owner when tab changes away from interactions
  useEffect(() => {
    if (activeTab !== 'interactions' && interactionOwnerLayerId) {
      setInteractionOwnerLayerId(null);
    }
  }, [activeTab, interactionOwnerLayerId]);

  // Update active interaction (current trigger and its target layers from tweens)
  useEffect(() => {
    if (activeTab === 'interactions' && interactionOwnerLayer) {
      const interactions = interactionOwnerLayer.interactions || [];
      const targetIds = new Set<string>();

      interactions.forEach(interaction => {
        (interaction.tweens || []).forEach(tween => {
          targetIds.add(tween.layer_id);
        });
      });

      if (targetIds.size > 0) {
        setActiveInteraction(interactionOwnerLayer.id, Array.from(targetIds));
      } else {
        clearActiveInteraction();
      }
    } else {
      clearActiveInteraction();
    }
  }, [activeTab, interactionOwnerLayer, setActiveInteraction, clearActiveInteraction]);

  // Compute interaction highlights from all layers (always shown, styling varies by tab)
  useEffect(() => {
    const triggerIds = new Set<string>();
    const targetIds = new Set<string>();

    const collectInteractions = (layers: Layer[]) => {
      layers.forEach(layer => {
        const interactions = layer.interactions || [];
        const hasTweens = interactions.some(i => (i.tweens || []).length > 0);

        if (hasTweens) {
          triggerIds.add(layer.id);
          interactions.forEach(interaction => {
            (interaction.tweens || []).forEach(tween => {
              targetIds.add(tween.layer_id);
            });
          });
        }

        if (layer.children) {
          collectInteractions(layer.children);
        }
      });
    };

    collectInteractions(allLayers);
    setInteractionHighlights(Array.from(triggerIds), Array.from(targetIds));
  }, [allLayers, setInteractionHighlights]);

  // Handle all interaction state changes from InteractionsPanel
  const handleInteractionStateChange = useCallback((state: {
    selectedTriggerId?: string | null;
    shouldRefresh?: boolean;
  }) => {
    // Handle trigger selection
    if (state.selectedTriggerId !== undefined) {
      setSelectedTriggerId(state.selectedTriggerId);
    }

    // Handle refresh request
    if (state.shouldRefresh && selectedLayerId) {
      setInteractionOwnerLayerId(selectedLayerId);
      setSelectedTriggerId(null);
      setInteractionResetKey(prev => prev + 1);
    }
  }, [selectedLayerId]);

  // Helper function to check if layer is a heading
  const isHeadingLayer = (layer: Layer | null): boolean => {
    if (!layer) return false;
    const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'heading'];
    return headingTags.includes(layer.name || '') ||
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
    return containerTags.includes(layer.name || '') ||
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
    if (layer.name === 'section') return 'section';

    return 'div'; // Default fallback
  };

  // Classes input state (synced with selectedLayer)
  const [classesInput, setClassesInput] = useState<string>('');

  // Sync classesInput when selectedLayer changes
  useEffect(() => {
    if (!selectedLayer?.classes) {
      setClassesInput('');
    } else {
      const classes = Array.isArray(selectedLayer.classes)
        ? selectedLayer.classes.join(' ')
        : selectedLayer.classes;
      setClassesInput(classes);
    }
  }, [selectedLayer]);

  // Parse classes into array for badge display
  const classesArray = useMemo(() => {
    return classesInput.split(' ').filter(cls => cls.trim() !== '');
  }, [classesInput]);

  // Update local state when selected layer changes (for settings fields)
  const [prevSelectedLayerId, setPrevSelectedLayerId] = useState<string | null>(null);
  if (selectedLayerId !== prevSelectedLayerId) {
    setPrevSelectedLayerId(selectedLayerId);
    setCustomId(selectedLayer?.settings?.id || '');
    setIsHidden(selectedLayer?.settings?.hidden || false);
    setHeadingTag(selectedLayer?.settings?.tag || getDefaultHeadingTag(selectedLayer));
    setContainerTag(selectedLayer?.settings?.tag || getDefaultContainerTag(selectedLayer));
  }

  // Debounced updater for classes
  const debouncedUpdate = useMemo(
    () =>
      debounce((layerId: string, classes: string) => {
        onLayerUpdate(layerId, { classes });
      }, 500),
    [onLayerUpdate]
  );

  const handleClassesChange = useCallback((value: string) => {
    setClassesInput(value);
    if (selectedLayerId) {
      debouncedUpdate(selectedLayerId, value);
    }
  }, [debouncedUpdate, selectedLayerId]);

  // Add a new class
  const addClass = useCallback((newClass: string) => {
    if (!newClass.trim() || !selectedLayer) return;
    const trimmedClass = newClass.trim();
    if (classesArray.includes(trimmedClass)) return; // Don't add duplicates

    // Remove any conflicting classes before adding the new one
    const classesWithoutConflicts = removeConflictsForClass(classesArray, trimmedClass);

    // Parse the new class to extract design properties
    const parsedDesign = classesToDesign([trimmedClass]);

    // Merge with existing design
    const updatedDesign = mergeDesign(selectedLayer.design, parsedDesign);

    // Add the new class (after removing conflicts)
    // Note: Use join instead of cn() here because removeConflictsForClass
    // already handles property-aware conflict resolution
    const newClasses = [...classesWithoutConflicts, trimmedClass].join(' ');

    // Update layer with both classes AND design object
    onLayerUpdate(selectedLayer.id, {
      classes: newClasses,
      design: updatedDesign
    });

    setCurrentClassInput('');
  }, [classesArray, onLayerUpdate, selectedLayer]);

  // Remove a class
  const removeClass = useCallback((classToRemove: string) => {
    if (!selectedLayer) return;
    const newClasses = classesArray.filter(cls => cls !== classToRemove).join(' ');
    setClassesInput(newClasses);
    handleClassesChange(newClasses);
  }, [classesArray, handleClassesChange, selectedLayer]);

  // Handle Enter key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addClass(currentClassInput);
    }
  }, [currentClassInput, addClass]);

  const addClasses = (newClasses: string) => {
    if (!selectedLayerId) return;
    const currentClasses = classesInput;
    // Use cn() to ensure proper merging and avoid duplicates
    const updated = cn(currentClasses, newClasses);
    onLayerUpdate(selectedLayerId, { classes: updated });
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

  // Handle content change (with inline variables)
  const handleContentChange = useCallback((value: string) => {
    if (!selectedLayerId) return;

    const hasInlineVariables = value.includes('<ycode-inline-variable>');

    // Check if content is ONLY variables (no plain text after removing variable tags)
    const onlyVariables = hasInlineVariables &&
      value.replace(/<ycode-inline-variable>[\s\S]*?<\/ycode-inline-variable>/g, '').trim() === '';

    onLayerUpdate(selectedLayerId, {
      text: hasInlineVariables ? (onlyVariables ? undefined : value) : value,
      variables: {
        ...selectedLayer?.variables,
        text: hasInlineVariables ? value : undefined,
      },
    });
  }, [selectedLayerId, selectedLayer, onLayerUpdate]);

  // Get content value for display
  const getContentValue = useCallback((layer: Layer | null): string => {
    if (!layer) return '';

    // Priority 1: Check layer.variables.text (now a simple string with embedded JSON)
    if (layer.variables?.text) {
      return layer.variables.text;
    }

    // Priority 2: Check layer.text (legacy)
    if (layer.text && typeof layer.text === 'string') {
      return layer.text;
    }

    return '';
  }, []);

  // Handle collection binding change
  const handleCollectionChange = (collectionId: string) => {
    if (selectedLayerId && selectedLayer) {
      const currentCollectionVariable = getCollectionVariable(selectedLayer);
      onLayerUpdate(selectedLayerId, {
        variables: {
          ...selectedLayer?.variables,
          collection: collectionId ? {
            id: collectionId,
            // Preserve existing sort settings when changing collection
            sort_by: currentCollectionVariable?.sort_by,
            sort_order: currentCollectionVariable?.sort_order,
          } : undefined
        }
      });
    }
  };

  // Handle sort by change
  const handleSortByChange = (sortBy: string) => {
    if (selectedLayerId && selectedLayer) {
      const currentCollectionVariable = getCollectionVariable(selectedLayer);
      if (currentCollectionVariable) {
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            collection: {
              ...currentCollectionVariable,
              sort_by: sortBy,
              // Reset sort_order to 'asc' when changing sort_by
              sort_order: (sortBy !== 'none' && sortBy !== 'manual' && sortBy !== 'random') ? 'asc' : currentCollectionVariable.sort_order,
            }
          }
        });
      }
    }
  };

  // Handle sort order change
  const handleSortOrderChange = (sortOrder: 'asc' | 'desc') => {
    if (selectedLayerId && selectedLayer) {
      const currentCollectionVariable = getCollectionVariable(selectedLayer);
      if (currentCollectionVariable) {
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            collection: {
              ...currentCollectionVariable,
              sort_order: sortOrder,
            }
          }
        });
      }
    }
  };

  // Handle limit change
  const handleLimitChange = (value: string) => {
    if (selectedLayerId && selectedLayer) {
      const currentCollectionVariable = getCollectionVariable(selectedLayer);
      if (currentCollectionVariable) {
        const limit = value === '' ? undefined : parseInt(value, 10);
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            collection: {
              ...currentCollectionVariable,
              limit: limit && limit > 0 ? limit : undefined,
            }
          }
        });
      }
    }
  };

  // Handle offset change
  const handleOffsetChange = (value: string) => {
    if (selectedLayerId && selectedLayer) {
      const currentCollectionVariable = getCollectionVariable(selectedLayer);
      if (currentCollectionVariable) {
        const offset = value === '' ? undefined : parseInt(value, 10);
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            collection: {
              ...currentCollectionVariable,
              offset: offset && offset >= 0 ? offset : undefined,
            }
          }
        });
      }
    }
  };

  // Handle field binding change
  const handleFieldBindingChange = (fieldId: string) => {
    if (selectedLayerId) {
      if (fieldId && fieldId !== 'none') {
        onLayerUpdate(selectedLayerId, {
          text: {
            type: 'field',
            data: {
              field_id: fieldId,
              relationships: [],
            }
          } as any
        });
      } else {
        // Clear field binding
        onLayerUpdate(selectedLayerId, {
          text: undefined
        });
      }
    }
  };

  // Handle image field binding change
  const handleImageFieldBindingChange = (fieldId: string) => {
    if (selectedLayerId) {
      if (fieldId && fieldId !== 'none') {
        onLayerUpdate(selectedLayerId, {
          url: {
            type: 'field',
            data: {
              field_id: fieldId,
              relationships: [],
            }
          } as any
        });
      } else {
        // Clear field binding
        onLayerUpdate(selectedLayerId, {
          url: undefined
        });
      }
    }
  };

  // Get parent collection layer for the selected layer
  const parentCollectionLayer = useMemo(() => {
    if (!selectedLayerId || !currentPageId) return null;

    // Get layers from either component draft or page draft
    let layers: Layer[] = [];
    if (editingComponentId) {
      layers = componentDrafts[editingComponentId] || [];
    } else {
      const draft = draftsByPageId[currentPageId];
      layers = draft ? draft.layers : [];
    }

    if (!layers.length) return null;

    // Use the utility function from layer-utils
    return findParentCollectionLayer(layers, selectedLayerId);
  }, [selectedLayerId, editingComponentId, componentDrafts, currentPageId, draftsByPageId]);

  // Get collection fields if parent collection layer exists
  const currentPage = useMemo(() => {
    if (!currentPageId) {
      return null;
    }
    return pages.find((page) => page.id === currentPageId) || null;
  }, [pages, currentPageId]);

  const parentCollectionFields = useMemo(() => {
    const collectionVariable = parentCollectionLayer ? getCollectionVariable(parentCollectionLayer) : null;
    let collectionId = collectionVariable?.id;

    if (!collectionId && currentPage?.is_dynamic) {
      collectionId = currentPage.settings?.cms?.collection_id || undefined;
    }

    if (!collectionId) return [];
    return fields[collectionId] || [];
  }, [parentCollectionLayer, fields, currentPage]);

  const fieldSourceLabel = useMemo(() => {
    // Check if fields come from parent collection layer
    if (parentCollectionLayer) {
      const collectionVariable = getCollectionVariable(parentCollectionLayer);
      const collectionId = collectionVariable?.id;
      if (collectionId) {
        const collection = collections.find(c => c.id === collectionId);
        return collection?.name; // Returns collection name like "Blog Posts"
      }
    }

    // Check if fields come from dynamic page
    if (currentPage?.is_dynamic && currentPage?.settings?.cms?.collection_id) {
      return 'CMS page data';
    }

    return undefined; // No label
  }, [parentCollectionLayer, currentPage, collections]);

  // Get collection fields for the currently selected collection layer (for Sort By dropdown)
  const selectedCollectionFields = useMemo(() => {
    if (!selectedLayer) return [];
    const collectionVariable = getCollectionVariable(selectedLayer);
    if (!collectionVariable) return [];

    const collectionId = collectionVariable?.id;
    if (!collectionId) return [];
    return fields[collectionId] || [];
  }, [selectedLayer, fields]);

  // Handle adding custom attribute
  const handleAddAttribute = () => {
    if (selectedLayerId && newAttributeName.trim()) {
      const currentSettings = selectedLayer?.settings || {};
      const currentAttributes = currentSettings.customAttributes || {};
      onLayerUpdate(selectedLayerId, {
        settings: {
          ...currentSettings,
          customAttributes: { ...currentAttributes, [newAttributeName.trim()]: newAttributeValue }
        }
      });
      // Reset form and close popover
      setNewAttributeName('');
      setNewAttributeValue('');
      setShowAddAttributePopover(false);
    }
  };

  // Handle removing custom attribute
  const handleRemoveAttribute = (name: string) => {
    if (selectedLayerId) {
      const currentSettings = selectedLayer?.settings || {};
      const currentAttributes = { ...currentSettings.customAttributes };
      delete currentAttributes[name];
      onLayerUpdate(selectedLayerId, {
        settings: {
          ...currentSettings,
          customAttributes: currentAttributes
        }
      });
    }
  };

  if (! selectedLayerId || ! selectedLayer) {
    return (
      <div className="w-64 shrink-0 bg-background border-l flex items-center justify-center h-screen">
        <span className="text-xs text-white/50">Select layer</span>
      </div>
    );
  }

  // Check if selected layer is a component instance
  const isComponentInstance = !!selectedLayer.componentId;
  const component = isComponentInstance ? getComponentById(selectedLayer.componentId!) : null;

  // If it's a component instance, show a message with edit button instead of design properties
  if (isComponentInstance && component && !editingComponentId) {
    const handleEditMasterComponent = () => {
      const { loadComponentDraft } = useComponentsStore.getState();
      const { setSelectedLayerId } = useEditorStore.getState();

      // Load the component's layers into draft
      loadComponentDraft(component.id);

      // Select the first layer of the component
      if (component.layers && component.layers.length > 0) {
        setSelectedLayerId(component.layers[0].id);
      } else {
        setSelectedLayerId(null);
      }

      // Open component (updates state + URL)
      openComponent(component.id, currentPageId);
    };

    return (
      <div className="w-64 shrink-0 bg-background border-l flex flex-col p-4 pb-0 h-full overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <Empty>
            <EmptyTitle>Component Instance</EmptyTitle>
            <EmptyDescription>
              This is an instance of &quot;{component.name}&quot;. To edit this component, click the button below or right-click and select &quot;Edit master component&quot;.
            </EmptyDescription>
            <div>
              <Button
                onClick={handleEditMasterComponent}
                variant="secondary"
                size="sm"
              >
                Edit component
              </Button>
            </div>
          </Empty>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 bg-background border-l flex flex-col p-4 pb-0 h-full overflow-hidden">

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="">
          <TabsList className="w-full">
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="interactions">Interactions</TabsTrigger>
          </TabsList>
        </div>

        <hr className="mt-2" />

        {/* Content */}
        <TabsContent value="design" className="flex-1 flex flex-col divide-y overflow-y-auto no-scrollbar data-[state=inactive]:hidden overflow-x-hidden mt-0">
          {/* Layer Styles Panel */}
          <LayerStylesPanel
            layer={selectedLayer}
            pageId={currentPageId}
            onLayerUpdate={onLayerUpdate}
          />

          {/* Field Binding Panel - show for text/image layers inside a collection */}
          {selectedLayer && parentCollectionLayer && parentCollectionFields.length > 0 && selectedLayer.name === 'image' && (
            <SettingsPanel
              title="Field Binding"
              isOpen={fieldBindingOpen}
              onToggle={() => setFieldBindingOpen(!fieldBindingOpen)}
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2">
                  <Label>Image Field</Label>
                  <Select
                    value={isFieldVariable(selectedLayer.url) ? selectedLayer.url.data.field_id : 'none'}
                    onValueChange={handleImageFieldBindingChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">None (Static image)</SelectItem>
                        {parentCollectionFields.filter(f => f.type === 'image').map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Bind this image to a collection image field
                  </p>
                </div>
              </div>
            </SettingsPanel>
          )}

          {activeTab === 'design' && (
            <>
              <UIStateSelector selectedLayer={selectedLayer} />
            </>
          )}

          <LayoutControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <SpacingControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <SizingControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <TypographyControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <BackgroundsControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <BorderControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <EffectControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <PositionControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <SettingsPanel
            title="Classes"
            isOpen={classesOpen}
            onToggle={() => setClassesOpen(!classesOpen)}
          >
            <div className="flex flex-col gap-3">
              <Input
                value={currentClassInput}
                onChange={(e) => setCurrentClassInput(e.target.value)}
                onKeyDown={handleKeyPress}
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
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="settings" className="flex-1 overflow-y-auto no-scrollbar mt-0 data-[state=inactive]:hidden">
          <div className="flex flex-col divide-y">
            {/* Attributes Panel */}
            <SettingsPanel
              title="Attributes"
              isOpen={attributesOpen}
              onToggle={() => setAttributesOpen(!attributesOpen)}
            >
              <div className="grid grid-cols-3">
                <Label variant="muted">ID</Label>
                <div className="col-span-2 *:w-full">
                  <Input
                    type="text"
                    value={customId}
                    onChange={(e) => handleIdChange(e.target.value)}
                    placeholder="Identifier"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3">
                <Label variant="muted">Element</Label>
                <div className="col-span-2 *:w-full">
                  <ToggleGroup
                    options={[
                      { label: 'Shown', value: false },
                      { label: 'Hidden', value: true },
                    ]}
                    value={isHidden}
                    onChange={(value) => handleVisibilityChange(value as boolean)}
                  />
                </div>
              </div>

              {/* Heading Tag Selector - Only for headings */}
              {isHeadingLayer(selectedLayer) && (
                <div className="grid grid-cols-3">
                  <Label variant="muted">Tag</Label>
                  <div className="col-span-2 *:w-full">
                    <Select value={headingTag} onValueChange={handleHeadingTagChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="h1">H1</SelectItem>
                          <SelectItem value="h2">H2</SelectItem>
                          <SelectItem value="h3">H3</SelectItem>
                          <SelectItem value="h4">H4</SelectItem>
                          <SelectItem value="h5">H5</SelectItem>
                          <SelectItem value="h6">H6</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Container Tag Selector - Only for containers/sections/blocks */}
              {isContainerLayer(selectedLayer) && !isHeadingLayer(selectedLayer) && (
                <div className="grid grid-cols-3">
                  <Label variant="muted">Tag</Label>
                  <div className="col-span-2 *:w-full">
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
                </div>
              )}
            </SettingsPanel>

            {/* Content Panel - show for text-editable layers */}
            {selectedLayer && isTextEditable(selectedLayer) && (
              <SettingsPanel
                title="Content"
                isOpen={contentOpen}
                onToggle={() => setContentOpen(!contentOpen)}
              >
                <div className="flex flex-col gap-2">
                  <InputWithInlineVariables
                    value={getContentValue(selectedLayer)}
                    onChange={handleContentChange}
                    placeholder="Enter text..."
                    fields={parentCollectionFields}
                    fieldSourceLabel={fieldSourceLabel}
                  />
                </div>
              </SettingsPanel>
            )}

            {/* Collection Binding Panel - only show for collection layers */}
            {selectedLayer && getCollectionVariable(selectedLayer) && (
              <SettingsPanel
                title="CMS"
                isOpen={collectionBindingOpen}
                onToggle={() => setCollectionBindingOpen(!collectionBindingOpen)}
              >
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-3">
                    <Label variant="muted">Source</Label>
                    <div className="col-span-2 *:w-full">
                      <Select
                        value={getCollectionVariable(selectedLayer)?.id || ''}
                        onValueChange={handleCollectionChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a collection" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {collections.length > 0 ? (
                              collections.map((collection) => (
                                <SelectItem key={collection.id} value={collection.id}>
                                  {collection.name}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                No collections available
                              </div>
                            )}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Sort By - only show if collection is selected */}
                  {getCollectionVariable(selectedLayer)?.id && (
                    <>
                      <div className="grid grid-cols-3">
                        <Label variant="muted">Sort by</Label>
                        <div className="col-span-2 *:w-full">
                          <Select
                            value={getCollectionVariable(selectedLayer)?.sort_by || 'none'}
                            onValueChange={handleSortByChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select sorting" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="manual">Manual</SelectItem>
                                <SelectItem value="random">Random</SelectItem>
                              </SelectGroup>
                              <SelectGroup>
                                <SelectLabel>Fields</SelectLabel>
                                {selectedCollectionFields.length > 0 &&
                                  selectedCollectionFields.map((field) => (
                                    <SelectItem key={field.id} value={field.id}>
                                      {field.name}
                                    </SelectItem>
                                  ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Sort Order - only show when a field is selected */}
                      {getCollectionVariable(selectedLayer)?.sort_by &&
                        getCollectionVariable(selectedLayer)?.sort_by !== 'none' &&
                        getCollectionVariable(selectedLayer)?.sort_by !== 'manual' &&
                        getCollectionVariable(selectedLayer)?.sort_by !== 'random' && (
                          <div className="grid grid-cols-3">
                            <Label variant="muted">Sort order</Label>
                            <div className="col-span-2 *:w-full">
                              <Select
                                value={getCollectionVariable(selectedLayer)?.sort_order || 'asc'}
                                onValueChange={handleSortOrderChange}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="asc">Ascending</SelectItem>
                                    <SelectItem value="desc">Descending</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                      )}

                      {/* Total Limit */}
                      <div className="grid grid-cols-3">
                        <Label variant="muted">Total limit</Label>
                        <div className="col-span-2 *:w-full">
                          <Input
                            type="number"
                            min="1"
                            value={getCollectionVariable(selectedLayer)?.limit || ''}
                            onChange={(e) => handleLimitChange(e.target.value)}
                            placeholder="No limit"
                          />
                        </div>
                      </div>

                      {/* Offset */}
                      <div className="grid grid-cols-3">
                        <Label variant="muted">Offset</Label>
                        <div className="col-span-2 *:w-full">
                          <Input
                            type="number"
                            min="0"
                            value={getCollectionVariable(selectedLayer)?.offset || ''}
                            onChange={(e) => handleOffsetChange(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </SettingsPanel>
            )}

            {/* Custom Attributes Panel */}
            <SettingsPanel
              title="Custom attributes"
              isOpen={customAttributesOpen}
              onToggle={() => setCustomAttributesOpen(!customAttributesOpen)}
              action={
                <Popover open={showAddAttributePopover} onOpenChange={setShowAddAttributePopover}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="secondary"
                      size="xs"
                    >
                      <Icon name="plus" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="end">
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-3">
                          <Label variant="muted">Name</Label>
                          <div className="col-span-2 *:w-full">
                            <Input
                              value={newAttributeName}
                              onChange={(e) => setNewAttributeName(e.target.value)}
                              placeholder="e.g., data-id"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddAttribute();
                                }
                              }}
                            />
                          </div>
                      </div>

                      <div className="grid grid-cols-3">
                        <Label>Value</Label>
                          <div className="col-span-2 *:w-full">
                            <Input
                              value={newAttributeValue}
                              onChange={(e) => setNewAttributeValue(e.target.value)}
                              placeholder="e.g., 123"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddAttribute();
                                }
                              }}
                            />
                          </div>
                      </div>

                      <Button
                        onClick={handleAddAttribute}
                        disabled={!newAttributeName.trim()}
                        size="sm"
                        variant="secondary"
                      >
                        Add attribute
                      </Button>

                    </div>
                  </PopoverContent>
                </Popover>
              }
            >
              {selectedLayer?.settings?.customAttributes &&
               Object.keys(selectedLayer.settings.customAttributes).length > 0 ? (
                <div className="flex flex-col gap-1">
                  {Object.entries(selectedLayer.settings.customAttributes).map(([name, value]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between pl-3 pr-1 h-8 bg-muted text-muted-foreground rounded-lg"
                    >
                      <span>{name}=&quot;{value as string}&quot;</span>
                      <Button
                        onClick={() => handleRemoveAttribute(name)}
                        variant="ghost"
                        size="xs"
                      >
                        <Icon name="x" />
                      </Button>
                    </div>
                  ))}
                </div>
                ) : (
                <Empty>
                  <EmptyDescription>HTML attributes can be used to append additional information to your elements.</EmptyDescription>
                </Empty>
                )}
            </SettingsPanel>

            <ImageSettings
              layer={selectedLayer}
              onLayerUpdate={onLayerUpdate}
              fields={parentCollectionFields}
              fieldSourceLabel={fieldSourceLabel}
            />

            <ConditionalVisibilitySettings
              layer={selectedLayer}
              onLayerUpdate={onLayerUpdate}
              fields={parentCollectionFields}
              fieldSourceLabel={fieldSourceLabel}
            />

          </div>
        </TabsContent>

        <TabsContent value="interactions" className="flex-1 overflow-y-auto no-scrollbar mt-0 data-[state=inactive]:hidden">
          {interactionOwnerLayer ? (
            <InteractionsPanel
              triggerLayer={interactionOwnerLayer}
              allLayers={allLayers}
              onLayerUpdate={onLayerUpdate}
              selectedLayerId={selectedLayerId}
              resetKey={interactionResetKey}
              activeBreakpoint={activeBreakpoint}
              onStateChange={handleInteractionStateChange}
              onSelectLayer={setSelectedLayerId}
            />
          ) : (
            <Empty>
              <EmptyTitle>No Layer Selected</EmptyTitle>
              <EmptyDescription>
                Select a layer to edit its interactions
              </EmptyDescription>
            </Empty>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
});

export default RightSidebar;

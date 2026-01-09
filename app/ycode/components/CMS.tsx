'use client';

/**
 * CMS Component
 *
 * Content Management System interface for managing collection items with EAV architecture.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue, SelectGroup } from '@/components/ui/select';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useCollaborationPresenceStore, getResourceLockKey } from '@/stores/useCollaborationPresenceStore';
import { useLiveCollectionUpdates } from '@/hooks/use-live-collection-updates';
import { useResourceLock } from '@/hooks/use-resource-lock';
import { collectionsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { slugify } from '@/lib/collection-utils';
import { FIELD_TYPES, type FieldType } from '@/lib/field-types-config';
import { useEditorUrl } from '@/hooks/use-editor-url';
import FieldsDropdown from './FieldsDropdown';
import CollectionItemContextMenu from './CollectionItemContextMenu';
import FieldFormPopover from './FieldFormPopover';
import CollectionItemSheet from './CollectionItemSheet';
import { CollaboratorBadge } from '@/components/collaboration/CollaboratorBadge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { CollectionItemWithValues, CollectionField } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Badge } from '@/components/ui/badge';

/**
 * Helper component to render reference field values in CMS list
 */
interface ReferenceFieldCellProps {
  value: string;
  field: CollectionField;
  referenceItemsCache: Record<string, Record<string, string>>; // collectionId -> { itemId -> displayName }
  fields: Record<string, CollectionField[]>; // All fields by collection ID
}

function ReferenceFieldCell({ value, field, referenceItemsCache, fields }: ReferenceFieldCellProps) {
  if (!value || !field.reference_collection_id) {
    return <span className="text-muted-foreground">-</span>;
  }

  const refCollectionId = field.reference_collection_id;
  const cache = referenceItemsCache[refCollectionId] || {};

  if (field.type === 'multi_reference') {
    // Parse JSON array of IDs
    try {
      const ids = JSON.parse(value);
      if (!Array.isArray(ids) || ids.length === 0) {
        return <span className="text-muted-foreground">-</span>;
      }
      return (
        <Badge variant="secondary" className="font-normal">
          {ids.length} item{ids.length !== 1 ? 's' : ''}
        </Badge>
      );
    } catch {
      return <span className="text-muted-foreground">-</span>;
    }
  }

  // Single reference - show item name
  const displayName = cache[value];
  if (displayName) {
    return <span>{displayName}</span>;
  }

  // Loading or not found
  return <span className="text-muted-foreground">Loading...</span>;
}

// Lock info for displaying collaborator badge
interface ItemLockInfo {
  isLocked: boolean;
  ownerUserId?: string;
  ownerEmail?: string;
  ownerColor?: string;
}

// Sortable row component for drag and drop
interface SortableRowProps {
  item: CollectionItemWithValues;
  isManualMode: boolean;
  children: React.ReactNode;
  onDuplicate: () => void;
  onDelete: () => void;
  lockInfo?: ItemLockInfo;
}

function SortableRow({ item, isManualMode, children, onDuplicate, onDelete, lockInfo }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !isManualMode });

  const isLockedByOther = lockInfo?.isLocked;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isLockedByOther ? 0.7 : 1,
    cursor: isManualMode ? 'grab' : isLockedByOther ? 'not-allowed' : 'pointer',
  };

  return (
    <CollectionItemContextMenu
      onDuplicate={onDuplicate}
      onDelete={onDelete}
    >
      <tr
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...(isManualMode ? listeners : {})}
        className={`group border-b hover:bg-secondary/50 transition-colors ${isLockedByOther ? 'bg-secondary/30' : ''}`}
      >
        {children}
        {/* Lock indicator - as proper table cell */}
        <td className="w-10 px-2 text-center">
          {isLockedByOther && lockInfo && (
            <CollaboratorBadge
              collaborator={{
                userId: lockInfo.ownerUserId || '',
                email: lockInfo.ownerEmail,
                color: lockInfo.ownerColor,
              }}
              size="sm"
              tooltipPrefix="Editing by"
            />
          )}
        </td>
      </tr>
    </CollectionItemContextMenu>
  );
}

const CMS = React.memo(function CMS() {
  const {
    selectedCollectionId,
    collections,
    fields,
    items,
    itemsTotalCount,
    isLoading,
    loadFields,
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    duplicateItem,
    deleteField,
    updateField,
    createField,
    updateCollectionSorting,
    reorderItems,
    searchItems,
  } = useCollectionsStore();

  // Collection collaboration sync
  const liveCollectionUpdates = useLiveCollectionUpdates();
  
  // Item locking for collaboration
  const itemLock = useResourceLock({
    resourceType: 'collection_item',
    channelName: selectedCollectionId ? `collection:${selectedCollectionId}:item_locks` : '',
  });
  
  // Subscribe to resource locks to trigger re-renders when locks change
  const resourceLocks = useCollaborationPresenceStore((state) => state.resourceLocks);
  const collaborationUsers = useCollaborationPresenceStore((state) => state.users);

  const { urlState, navigateToCollection, navigateToCollectionItem, navigateToNewCollectionItem } = useEditorUrl();

  // Track previous collection ID to prevent unnecessary reloads
  const prevCollectionIdRef = React.useRef<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');
  // Initialize from URL state to prevent overwriting URL params
  const [currentPage, setCurrentPage] = useState(urlState.page || 1);
  const [pageSize, setPageSize] = useState(urlState.pageSize || 25);
  const [showItemSheet, setShowItemSheet] = useState(false);
  const [editingItem, setEditingItem] = useState<CollectionItemWithValues | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [createFieldPopoverOpen, setCreateFieldPopoverOpen] = useState(false);
  const [editFieldDialogOpen, setEditFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CollectionField | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);
  // Cache for reference item display names: { collectionId: { itemId: displayName } }
  const [referenceItemsCache, setReferenceItemsCache] = useState<Record<string, Record<string, string>>>({});

  const selectedCollection = collections.find(c => c.id === selectedCollectionId);
  const collectionFields = useMemo(
    () => (selectedCollectionId ? (fields[selectedCollectionId] || []) : []),
    [selectedCollectionId, fields]
  );
  const collectionItems = useMemo(
    () => (selectedCollectionId ? (items[selectedCollectionId] || []) : []),
    [selectedCollectionId, items]
  );
  const totalItems = selectedCollectionId ? (itemsTotalCount[selectedCollectionId] || 0) : 0;

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
  );

  // Check if we're in manual sort mode
  const isManualMode = selectedCollection?.sorting?.direction === 'manual';

  // Debounced skeleton loading state to prevent flickering
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isLoading) {
      // Only show skeleton after 150ms to avoid flicker on fast loads
      timeoutId = setTimeout(() => {
        setShowSkeleton(true);
      }, 150);
    } else {
      // Hide skeleton immediately when loading completes
      setShowSkeleton(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading]);

  // Sync search and page from URL on collection change or URL change
  useEffect(() => {
    if (selectedCollectionId) {
      // Only update if collection changed or URL search/page/pageSize changed
      const urlSearch = urlState.search || '';
      const urlPage = urlState.page || 1;
      const urlPageSize = urlState.pageSize || 25;

      if (prevCollectionIdRef.current !== selectedCollectionId) {
        // Collection changed - use URL state or reset
        setSearchQuery(urlSearch);
        setCurrentPage(urlPage);
        setPageSize(urlPageSize);
      } else {
        // Same collection - sync with URL if different
        if (urlSearch !== searchQuery) {
          setSearchQuery(urlSearch);
        }
        if (urlPage !== currentPage) {
          setCurrentPage(urlPage);
        }
        if (urlPageSize !== pageSize) {
          setPageSize(urlPageSize);
        }
      }
    }
  }, [selectedCollectionId, urlState.search, urlState.page, urlState.pageSize]);

  // Update URL when search or page changes locally (debounced to prevent loops)
  const updateUrlTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!selectedCollectionId) return;

    // Clear any pending updates
    if (updateUrlTimeoutRef.current) {
      clearTimeout(updateUrlTimeoutRef.current);
    }

    // Debounce URL updates to prevent race conditions with URL sync
    updateUrlTimeoutRef.current = setTimeout(() => {
      const urlSearch = urlState.search || '';
      const urlPage = urlState.page || 1;
      const urlPageSize = urlState.pageSize || 25;

      // Only update URL if local state is different from URL state
      if (searchQuery !== urlSearch || currentPage !== urlPage || pageSize !== urlPageSize) {
        navigateToCollection(
          selectedCollectionId,
          currentPage,
          searchQuery || undefined,
          pageSize
        );
      }
    }, 100); // 100ms debounce

    return () => {
      if (updateUrlTimeoutRef.current) {
        clearTimeout(updateUrlTimeoutRef.current);
      }
    };
  }, [searchQuery, currentPage, pageSize, selectedCollectionId]);

  // Load fields and items when collection changes (not when just navigating within same collection)
  useEffect(() => {
    if (selectedCollectionId) {
      // Only reload if the collection actually changed
      if (prevCollectionIdRef.current !== selectedCollectionId) {
        // Use URL state for initial page, search, and pageSize, or defaults
        const initialPage = urlState.page || 1;
        const initialSearch = urlState.search || '';
        const initialPageSize = urlState.pageSize || 25;

        loadFields(selectedCollectionId);
        loadItems(selectedCollectionId, initialPage, initialPageSize);

        // Clear selections when switching collections
        setSelectedItemIds(new Set());
        setFieldSearchQuery('');

        // Update the ref to track current collection
        prevCollectionIdRef.current = selectedCollectionId;
      }
    } else {
      // Reset ref when no collection selected
      prevCollectionIdRef.current = null;
    }
  }, [selectedCollectionId, urlState.page, urlState.search, urlState.pageSize, loadFields, loadItems]);

  // Debounced field search - queries backend (only when user types, not on collection change)
  useEffect(() => {
    if (!selectedCollectionId || !fieldSearchQuery) return;

    const debounceTimer = setTimeout(() => {
      loadFields(selectedCollectionId, fieldSearchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(debounceTimer);
  }, [fieldSearchQuery]); // Only trigger on search query change, not collection change

  // Debounced search - queries backend with pagination (only when user types or changes page, not on collection change)
  useEffect(() => {
    if (!selectedCollectionId) return;

    const debounceTimer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchItems(selectedCollectionId, searchQuery, currentPage, pageSize);
      } else {
        // If search is empty, reload all items
        loadItems(selectedCollectionId, currentPage, pageSize);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, currentPage, pageSize]); // Only trigger on search/pagination changes, not collection change

  // Reset to page 1 when search query changes (only if user typed, not from URL sync)
  const prevSearchRef = React.useRef<string>('');
  useEffect(() => {
    // Only reset page if search changed from user input (not initial URL load)
    if (prevSearchRef.current !== searchQuery && prevSearchRef.current !== '') {
      setCurrentPage(1);
    }
    prevSearchRef.current = searchQuery;
  }, [searchQuery]);

  // Reset to page 1 when sorting changes (only if user changed it, not on initial collection load)
  const prevSortingRef = React.useRef<{ field?: string; direction?: string } | null | undefined>(undefined);
  useEffect(() => {
    // Only reset page if sorting changed from user input (not initial collection load)
    // Skip reset on first mount or when collection first loads (when prevSortingRef is undefined)
    if (prevSortingRef.current !== undefined && prevSortingRef.current !== selectedCollection?.sorting) {
      setCurrentPage(1);
    }
    prevSortingRef.current = selectedCollection?.sorting;
  }, [selectedCollection?.sorting]);

  // Reset to page 1 when page size changes (only if user changed it, not from URL sync)
  const prevPageSizeRef = React.useRef<number | null>(null);
  useEffect(() => {
    // Only reset page if pageSize changed from user input (not initial URL load)
    // Skip reset on first mount (when prevPageSizeRef is null)
    if (prevPageSizeRef.current !== null && prevPageSizeRef.current !== pageSize) {
      setCurrentPage(1);
    }
    prevPageSizeRef.current = pageSize;
  }, [pageSize]);

  // Track fetched reference collections to prevent duplicate calls
  const fetchedReferenceCollections = React.useRef<Set<string>>(new Set());

  // Reset fetched collections when the selected collection changes
  useEffect(() => {
    fetchedReferenceCollections.current.clear();
    setReferenceItemsCache({});
  }, [selectedCollectionId]);

  // Fetch referenced item display names for reference fields in the list
  useEffect(() => {
    if (!selectedCollectionId || !collectionItems.length || !collectionFields.length) return;

    // Find reference/multi_reference fields that need data
    const refFields = collectionFields.filter(
      f => (f.type === 'reference' || f.type === 'multi_reference') && f.reference_collection_id
    );

    if (refFields.length === 0) return;

    // Collect all referenced collection IDs that we haven't fetched yet
    const collectionsToFetch = new Set<string>();

    refFields.forEach(field => {
      if (field.reference_collection_id && !fetchedReferenceCollections.current.has(field.reference_collection_id)) {
        collectionsToFetch.add(field.reference_collection_id);
      }
    });

    if (collectionsToFetch.size === 0) return;

    // Fetch display names for each collection
    const fetchReferencedItems = async () => {
      const newCache: Record<string, Record<string, string>> = {};

      for (const collectionId of collectionsToFetch) {
        // Mark as fetched to prevent duplicate calls
        fetchedReferenceCollections.current.add(collectionId);

        try {
          // Fetch items from this collection
          const response = await collectionsApi.getItems(collectionId, { limit: 100 });
          if (response.error || !response.data?.items) continue;

          // Get the display field for this collection
          const refCollectionFields = fields[collectionId] || [];
          const displayField = refCollectionFields.find(f => f.key === 'title')
            || refCollectionFields.find(f => f.key === 'name')
            || refCollectionFields.find(f => f.type === 'text' && f.fillable)
            || refCollectionFields[0];

          // Build cache entries for all items in the collection
          newCache[collectionId] = {};
          response.data.items.forEach(item => {
            const displayValue = displayField
              ? item.values[displayField.id] || 'Untitled'
              : 'Untitled';
            newCache[collectionId][item.id] = displayValue;
          });
        } catch (error) {
          console.error(`Failed to fetch referenced items for collection ${collectionId}:`, error);
        }
      }

      if (Object.keys(newCache).length > 0) {
        setReferenceItemsCache(prev => ({ ...prev, ...newCache }));
      }
    };

    fetchReferencedItems();
  }, [selectedCollectionId, collectionItems.length, collectionFields, fields]);

  // Sync URL with item editing state (URL is source of truth for persistence, not immediate UI)
  useEffect(() => {
    if (!selectedCollectionId) return;

    if (urlState.itemId === 'new') {
      setEditingItem(null);
      setShowItemSheet(true);
    } else if (urlState.itemId) {
      const item = collectionItems.find(i => i.id === urlState.itemId);
      if (item) {
        setEditingItem(item);
        setShowItemSheet(true);
      }
    } else {
      setShowItemSheet(false);
      setEditingItem(null);
    }
  }, [urlState.itemId, selectedCollectionId, collectionItems]);

  // Sort items (search filtering now happens on backend)
  const sortedItems = React.useMemo(() => {
    const items = [...collectionItems];

    // Apply sorting
    const sorting = selectedCollection?.sorting;
    if (sorting) {
      items.sort((a, b) => {
        if (sorting.direction === 'manual') {
          // Sort by manual_order
          return a.manual_order - b.manual_order;
        }

        // Sort by field value
        const aValue = a.values[sorting.field] || '';
        const bValue = b.values[sorting.field] || '';

        // Try to parse as numbers if possible
        const aNum = parseFloat(String(aValue));
        const bNum = parseFloat(String(bValue));

        if (!isNaN(aNum) && !isNaN(bNum)) {
          // Numeric comparison
          return sorting.direction === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // String comparison
        const comparison = String(aValue).localeCompare(String(bValue));
        return sorting.direction === 'asc' ? comparison : -comparison;
      });
    } else {
      // Default: sort by manual_order
      items.sort((a, b) => a.manual_order - b.manual_order);
    }

    return items;
  }, [collectionItems, selectedCollection?.sorting]);

  // Helper to get lock info for an item
  const getItemLockInfo = (itemId: string): ItemLockInfo => {
    const lockKey = getResourceLockKey('collection_item', itemId);
    const lock = resourceLocks[lockKey];
    
    if (!lock || Date.now() > lock.expires_at) {
      return { isLocked: false };
    }
    
    // Check if locked by current user
    const currentUserId = useCollaborationPresenceStore.getState().currentUserId;
    if (lock.user_id === currentUserId) {
      return { isLocked: false }; // Not locked by "other" - current user can edit
    }
    
    const owner = collaborationUsers[lock.user_id];
    return {
      isLocked: true,
      ownerUserId: lock.user_id,
      ownerEmail: owner?.email,
      ownerColor: owner?.color,
    };
  };

  const handleCreateItem = () => {
    if (selectedCollectionId) {
      // Optimistically open sheet immediately for smooth UX
      setEditingItem(null);
      setShowItemSheet(true);
      // Then navigate to update URL
      navigateToNewCollectionItem(selectedCollectionId);
    }
  };

  const handleEditItem = (item: CollectionItemWithValues) => {
    if (selectedCollectionId) {
      // Check if item is locked by another user
      const lockInfo = getItemLockInfo(item.id);
      if (lockInfo.isLocked) {
        // Item is locked - don't open, user will see the visual lock indicator
        return;
      }
      
      // Optimistically open sheet immediately for smooth UX
      setEditingItem(item);
      setShowItemSheet(true);
      // Then navigate to update URL
      navigateToCollectionItem(selectedCollectionId, item.id);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedCollectionId) return;

    if (confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteItem(selectedCollectionId, itemId);
        
        // Broadcast item deletion to other collaborators
        if (liveCollectionUpdates) {
          liveCollectionUpdates.broadcastItemDelete(selectedCollectionId, itemId);
        }
      } catch (error) {
        console.error('Failed to delete item:', error);
      }
    }
  };

  const handleDuplicateItem = async (itemId: string) => {
    if (!selectedCollectionId) return;

    try {
      const newItem = await duplicateItem(selectedCollectionId, itemId);
      
      // Broadcast item creation to other collaborators
      if (liveCollectionUpdates && newItem) {
        liveCollectionUpdates.broadcastItemCreate(selectedCollectionId, newItem);
      }
    } catch (error) {
      console.error('Failed to duplicate item:', error);
    }
  };

  const handleColumnClick = async (fieldId: string) => {
    if (!selectedCollectionId || !selectedCollection) return;

    const currentSorting = selectedCollection.sorting;
    let newSorting;

    // Cycle through: manual → asc → desc → manual
    if (!currentSorting || currentSorting.field !== fieldId) {
      // First click on this field - set to manual mode
      newSorting = { field: fieldId, direction: 'manual' as const };
    } else if (currentSorting.direction === 'manual') {
      // Second click - set to ASC
      newSorting = { field: fieldId, direction: 'asc' as const };
    } else if (currentSorting.direction === 'asc') {
      // Third click - set to DESC
      newSorting = { field: fieldId, direction: 'desc' as const };
    } else {
      // Fourth click - back to manual mode
      newSorting = { field: fieldId, direction: 'manual' as const };
    }

    try {
      await updateCollectionSorting(selectedCollectionId, newSorting);
    } catch (error) {
      console.error('Failed to update sorting:', error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !selectedCollectionId) {
      return;
    }

    // Find the indices of the dragged and target items
    const oldIndex = sortedItems.findIndex(item => item.id === active.id);
    const newIndex = sortedItems.findIndex(item => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder the items array
    const reorderedItems = [...sortedItems];
    const [movedItem] = reorderedItems.splice(oldIndex, 1);
    reorderedItems.splice(newIndex, 0, movedItem);

    // Calculate new manual_order values for all affected items
    const updates = reorderedItems.map((item, index) => ({
      id: item.id,
      manual_order: index,
    }));

    try {
      await reorderItems(selectedCollectionId, updates);
      // Reset to page 1 after reordering to show the new order
      setCurrentPage(1);
    } catch (error) {
      console.error('Failed to reorder items:', error);
    }
  };

  const handleToggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItemIds);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItemIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItemIds.size === sortedItems.length) {
      // Deselect all
      setSelectedItemIds(new Set());
    } else {
      // Select all
      setSelectedItemIds(new Set(sortedItems.map(item => item.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedCollectionId || selectedItemIds.size === 0) return;

    const count = selectedItemIds.size;
    const itemText = count === 1 ? 'item' : 'items';

    if (confirm(`Are you sure you want to delete ${count} ${itemText}?`)) {
      try {
        // Use bulk delete API
        const response = await collectionsApi.bulkDeleteItems(Array.from(selectedItemIds));

        if (response.error) {
          throw new Error(response.error);
        }

        // Reload items to reflect deletion
        await loadItems(selectedCollectionId);

        // Clear selections after successful delete
        setSelectedItemIds(new Set());

        // Show success message if there were any errors
        if (response.data?.errors && response.data.errors.length > 0) {
          console.warn('Some items failed to delete:', response.data.errors);
          alert(`Deleted ${response.data.deleted} of ${count} ${itemText}. Some items failed to delete.`);
        }
      } catch (error) {
        console.error('Failed to delete items:', error);
        alert('Failed to delete items. Please try again.');
      }
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!selectedCollectionId) return;

    const field = collectionFields.find(f => f.id === fieldId);
    if (field?.key) {
      alert('Cannot delete built-in fields');
      return;
    }

    if (confirm('Are you sure you want to delete this field? This will remove it from all items.')) {
      try {
        await deleteField(selectedCollectionId, fieldId);
      } catch (error) {
        console.error('Failed to delete field:', error);
      }
    }
  };

  const handleHideField = async (fieldId: string) => {
    if (!selectedCollectionId) return;

    const field = collectionFields.find(f => f.id === fieldId);
    if (!field) return;

    try {
      await updateField(selectedCollectionId, fieldId, {
        hidden: !field.hidden,
      });
      // Reload fields to show updated state
      await loadFields(selectedCollectionId);
    } catch (error) {
      console.error('Failed to toggle field visibility:', error);
    }
  };

  const handleDuplicateField = async (fieldId: string) => {
    if (!selectedCollectionId) return;

    const field = collectionFields.find(f => f.id === fieldId);
    if (!field) return;

    try {
      const newOrder = collectionFields.length;
      // Store adds field to local state optimistically
      await createField(selectedCollectionId, {
        name: `${field.name} (Copy)`,
        type: field.type,
        default: field.default,
        fillable: field.fillable,
        order: newOrder,
        reference_collection_id: field.reference_collection_id,
        hidden: field.hidden,
        data: field.data,
      });
      // No reload needed - store already updated local state optimistically
    } catch (error) {
      console.error('Failed to duplicate field:', error);
    }
  };

  const handleToggleFieldVisibility = async (fieldId: string) => {
    if (!selectedCollectionId) return;

    const field = collectionFields.find(f => f.id === fieldId);
    if (!field) return;

    try {
      // Store updates field visibility optimistically
      await updateField(selectedCollectionId, fieldId, {
        hidden: !field.hidden,
      });
      // No reload needed - store already updated local state optimistically
    } catch (error) {
      console.error('Failed to toggle field visibility:', error);
    }
  };

  const handleReorderFields = async (reorderedFields: CollectionField[]) => {
    if (!selectedCollectionId) return;

    try {
      const fieldIds = reorderedFields.map(f => f.id);
      await collectionsApi.reorderFields(selectedCollectionId, fieldIds);
      // Reload fields to show new order (reorder API doesn't return updated fields)
      await loadFields(selectedCollectionId);
    } catch (error) {
      console.error('Failed to reorder fields:', error);
    }
  };

  const handleCreateFieldFromPopover = async (data: {
    name: string;
    type: FieldType;
    default: string;
    reference_collection_id?: string | null;
  }) => {
    if (!selectedCollectionId) return;

    try {
      const newOrder = collectionFields.length;

      // Store adds field to local state optimistically
      await createField(selectedCollectionId, {
        name: data.name,
        type: data.type,
        default: data.default || null,
        order: newOrder,
        fillable: true,
        key: null,
        hidden: false,
        reference_collection_id: data.reference_collection_id || null,
      });

      // No reload needed - store already updated local state optimistically

      // Close popover
      setCreateFieldPopoverOpen(false);
    } catch (error) {
      console.error('Failed to create field:', error);
    }
  };

  const handleEditFieldClick = (field: CollectionField) => {
    // Close the dropdown
    setOpenDropdownId(null);

    // Set the editing field and open dialog
    setEditingField(field);
    setEditFieldDialogOpen(true);
  };

  const handleUpdateFieldFromDialog = async (data: {
    name: string;
    type: FieldType;
    default: string;
    reference_collection_id?: string | null;
  }) => {
    if (!selectedCollectionId || !editingField) return;

    try {
      // Store updates local state optimistically
      await updateField(selectedCollectionId, editingField.id, {
        name: data.name,
        default: data.default || null,
        reference_collection_id: data.reference_collection_id,
      });

      // No reload needed - store already updated local state optimistically

      // Close dialog and reset
      setEditFieldDialogOpen(false);
      setEditingField(null);
    } catch (error) {
      console.error('Failed to update field:', error);
    }
  };

  // Memoize table to prevent unnecessary re-renders during navigation
  const tableContent = React.useMemo(() => {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedItems.map(item => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="pl-5 pr-3 py-5 text-left font-normal w-12">
                  <div className="flex">
                  <Checkbox
                    checked={sortedItems.length > 0 && selectedItemIds.size === sortedItems.length}
                    onCheckedChange={handleSelectAll}
                    disabled={showSkeleton}
                  />
                  </div>
                </th>

                {collectionFields.filter(f => !f.hidden).map((field) => {
                  const sorting = selectedCollection?.sorting;
                  const isActiveSort = sorting?.field === field.id;
                  const sortIcon = isActiveSort && sorting ? (
                    sorting.direction === 'manual' ? 'M' :
                      sorting.direction === 'asc' ? '↑' :
                        '↓'
                  ) : null;

                  return (
                    <th key={field.id} className="px-4 py-5 text-left font-normal">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => !showSkeleton && handleColumnClick(field.id)}
                          className="flex items-center gap-1 hover:opacity-50 cursor-pointer"
                          style={{ pointerEvents: showSkeleton ? 'none' : 'auto' }}
                        >
                          {field.name}
                          {sortIcon && (
                            <span className="text-xs font-mono">
                              {sortIcon}
                            </span>
                          )}
                        </button>
                        <DropdownMenu
                          open={openDropdownId === field.id}
                          onOpenChange={(open) => !showSkeleton && setOpenDropdownId(open ? field.id : null)}
                        >
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="xs"
                              variant="ghost"
                              className="-my-2"
                              disabled={showSkeleton}
                            >
                              <Icon name="more" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem
                              onSelect={() => handleEditFieldClick(field)}
                              disabled={!!field.key}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDuplicateField(field.id)}
                              disabled={!!field.key}
                            >
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleHideField(field.id)}
                              disabled={field.name.toLowerCase() === 'name'}
                            >
                              {field.hidden ? 'Show' : 'Hide'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteField(field.id)}
                              disabled={!!field.key}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-left font-medium text-sm w-24">
                  <FieldFormPopover
                    trigger={
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={showSkeleton}
                      >
                        <Icon name="plus" />
                        Add field
                      </Button>
                    }
                    mode="create"
                    currentCollectionId={selectedCollectionId || undefined}
                    onSubmit={handleCreateFieldFromPopover}
                    open={createFieldPopoverOpen}
                    onOpenChange={setCreateFieldPopoverOpen}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {showSkeleton && totalItems > 0 ? (
                // Skeleton loading rows - show exact expected number
                Array.from({ length: Math.min(pageSize, totalItems) }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="border-b">
                    <td className="pl-5 pr-3 py-5 w-12">
                      <div className="w-4 h-4 bg-secondary rounded animate-pulse" />
                    </td>
                    {collectionFields.filter(f => !f.hidden).map((field) => (
                      <td key={field.id} className="px-4 py-5">
                        <div className="h-4 bg-secondary/50 rounded-[6px] animate-pulse w-1/3" />
                      </td>
                    ))}
                    <td className="px-4 py-3"></td>
                  </tr>
                ))
              ) : showSkeleton ? (
                // No skeleton rows when totalItems is 0
                null
              ) : sortedItems.length > 0 ? (
                sortedItems.map((item) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    isManualMode={isManualMode}
                    onDuplicate={() => handleDuplicateItem(item.id)}
                    onDelete={() => handleDeleteItem(item.id)}
                    lockInfo={getItemLockInfo(item.id)}
                  >
                    <td
                      className="pl-5 pr-3 py-3 w-12"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isManualMode) {
                          handleEditItem(item);
                        }
                      }}
                    >
                      <div className="flex">
                      <Checkbox
                        checked={selectedItemIds.has(item.id)}
                        onCheckedChange={() => handleToggleItemSelection(item.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      </div>
                    </td>
                    {collectionFields.filter(f => !f.hidden).map((field) => {
                      const value = item.values[field.id];

                      // Format date fields
                      if (field.type === 'date' && value) {
                        return (
                          <td
                            key={field.id}
                            className="px-4 py-5 text-muted-foreground"
                            onClick={() => !isManualMode && handleEditItem(item)}
                          >
                            {formatDate(value, 'MMM D YYYY, HH:mm')}
                          </td>
                        );
                      }

                      // Reference and multi-reference fields
                      if ((field.type === 'reference' || field.type === 'multi_reference') && field.reference_collection_id) {
                        return (
                          <td
                            key={field.id}
                            className="px-4 py-5 text-muted-foreground"
                            onClick={() => !isManualMode && handleEditItem(item)}
                          >
                            <ReferenceFieldCell
                              value={value}
                              field={field}
                              referenceItemsCache={referenceItemsCache}
                              fields={fields}
                            />
                          </td>
                        );
                      }

                      return (
                        <td
                          key={field.id}
                          className="px-4 py-5 text-muted-foreground"
                          onClick={() => !isManualMode && handleEditItem(item)}
                        >
                          {value || '-'}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3"></td>
                  </SortableRow>
                ))
              ) : (
                <tr className="group">
                  <td colSpan={collectionFields.filter(f => !f.hidden).length + 2} className="px-4 ">
                    {searchQuery && collectionItems.length > 0 ? (
                      <div className="text-muted-foreground py-32">
                        No items found matching &quot;{searchQuery}&quot;
                      </div>
                    ) : (
                      <div></div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
    );
  }, [sortedItems, collectionFields, isManualMode, selectedItemIds, selectedCollection?.sorting, openDropdownId, createFieldPopoverOpen, searchQuery, collectionItems.length, showSkeleton, totalItems, pageSize, handleSelectAll, handleColumnClick, handleEditFieldClick, handleDuplicateField, handleHideField, handleDeleteField, handleCreateFieldFromPopover, handleDragEnd, handleDuplicateItem, handleDeleteItem, handleEditItem, handleToggleItemSelection, sensors]);

  // No collection selected
  if (!selectedCollectionId) {
    return (
      <div className="flex-1 bg-background flex items-center justify-center">
        <Empty>
          <EmptyTitle>No Collection Selected</EmptyTitle>
          <EmptyDescription>
            Select a collection from the sidebar to manage its items
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background flex flex-col">

      <div className="p-4 flex items-center justify-between border-b">

        <div className="w-full max-w-72">
          <InputGroup>
            <InputGroupInput
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={showSkeleton}
            />
            <InputGroupAddon>
              <Icon name="search" className="size-3" />
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="flex gap-2">
          {selectedItemIds.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={showSkeleton}
            >
              Delete
              <Badge variant="secondary" className="text-[10px] px-1.5">{selectedItemIds.size}</Badge>
            </Button>
          )}

          <FieldsDropdown
            fields={collectionFields}
            searchQuery={fieldSearchQuery}
            onSearchChange={setFieldSearchQuery}
            onToggleVisibility={handleToggleFieldVisibility}
            onReorder={handleReorderFields}
          />

          <Button
            size="sm"
            variant="secondary"
            onClick={handleCreateItem}
            disabled={collectionFields.length === 0 || showSkeleton}
          >
            <Icon name="plus" />
            New Item
          </Button>
        </div>
      </div>

      {/* Items Content */}
      <div className="flex-1 overflow-auto flex flex-col">
        {collectionFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 p-8">
            <Empty>
              <EmptyTitle>No Fields Defined</EmptyTitle>
              <EmptyDescription>
                This collection has no fields. Add fields to start managing items.
              </EmptyDescription>
            </Empty>
            <FieldFormPopover
              trigger={
                <Button>
                  <Icon name="plus" />
                  Add Field
                </Button>
              }
              mode="create"
              currentCollectionId={selectedCollectionId || undefined}
              onSubmit={handleCreateFieldFromPopover}
              open={createFieldPopoverOpen}
              onOpenChange={setCreateFieldPopoverOpen}
            />
          </div>
        ) : (
          <>
            {tableContent}

            <div>
              <div>
                {/* Add Item Button */}
                {!showSkeleton && (
                  <div className="group cursor-pointer" onClick={handleCreateItem}>
                    <div className="grid grid-flow-col text-muted-foreground group-hover:bg-secondary/50">
                      <div className="px-4 py-4">
                        <Button size="xs" variant="ghost">
                          <Icon name="plus" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sheet for Create/Edit Item */}
                <CollectionItemSheet
                  open={showItemSheet}
                  onOpenChange={(open) => {
                    if (!open) {
                      // Optimistically close sheet immediately for smooth UX
                      setShowItemSheet(false);
                      setEditingItem(null);
                      // Then navigate to update URL
                      if (selectedCollectionId) {
                        navigateToCollection(selectedCollectionId);
                      }
                    }
                  }}
                  collectionId={selectedCollectionId!}
                  itemId={editingItem?.id || null}
                  onSuccess={() => {
                    setShowItemSheet(false);
                    setEditingItem(null);
                    if (selectedCollectionId) {
                      navigateToCollection(selectedCollectionId);
                    }
                  }}
                />
              </div>
            </div>

            {/* Pagination Controls */}
            {selectedCollectionId && (showSkeleton || sortedItems.length > 0) && (
              <div className="flex items-center justify-between px-4 py-4 border-t mt-auto">

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Show:</span>
                  {showSkeleton ? (
                    <div className="w-20 h-8 bg-secondary/50 rounded-lg animate-pulse" />
                  ) : (
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => setPageSize(Number(value))}
                      disabled={showSkeleton}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {showSkeleton ? (
                    <div className="h-4 w-48 bg-secondary/50 rounded-[6px] animate-pulse" />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} results
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || showSkeleton}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage * pageSize >= totalItems || showSkeleton}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Field Dialog using FieldFormPopover */}
      {editingField && (
        <FieldFormPopover
          mode="edit"
          field={editingField}
          currentCollectionId={selectedCollectionId || undefined}
          onSubmit={handleUpdateFieldFromDialog}
          open={editFieldDialogOpen}
          onOpenChange={(open) => {
            setEditFieldDialogOpen(open);
            if (!open) {
              setEditingField(null);
            }
          }}
          useDialog={true}
        />
      )}
    </div>
  );
});

export default CMS;

/**
 * CMS Component
 *
 * Content Management System interface for managing collection items with EAV architecture.
 */
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetActions,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Spinner } from '@/components/ui/spinner';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue, SelectGroup } from '@/components/ui/select';
import { TiptapEditor } from '@/components/ui/tiptap-editor';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { collectionsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { FIELD_TYPES, type FieldType } from '@/lib/field-types-config';
import FieldsDropdown from './FieldsDropdown';
import CollectionItemContextMenu from './CollectionItemContextMenu';
import FieldFormPopover from './FieldFormPopover';
import type { CollectionItemWithValues, CollectionField } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';

// Sortable row component for drag and drop
interface SortableRowProps {
  item: CollectionItemWithValues;
  isManualMode: boolean;
  children: React.ReactNode;
  onDuplicate: () => void;
  onDelete: () => void;
}

function SortableRow({ item, isManualMode, children, onDuplicate, onDelete }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !isManualMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isManualMode ? 'grab' : 'pointer',
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
        className="group border-b hover:bg-secondary/50 transition-colors"
      >
        {children}
      </tr>
    </CollectionItemContextMenu>
  );
}

export default function CMS() {
  const {
    selectedCollectionId,
    collections,
    fields,
    items,
    itemsTotalCount,
    isLoading,
    loadFields,
    loadItems,
    deleteItem,
    duplicateItem,
    deleteField,
    updateField,
    createField,
    updateCollectionSorting,
    reorderItems,
    searchItems,
  } = useCollectionsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showItemSheet, setShowItemSheet] = useState(false);
  const [editingItem, setEditingItem] = useState<CollectionItemWithValues | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [createFieldPopoverOpen, setCreateFieldPopoverOpen] = useState(false);
  const [editFieldDialogOpen, setEditFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CollectionField | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

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

  // Form for Sheet
  const form = useForm({
    defaultValues: {} as Record<string, any>,
  });

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

  // Load fields and items when collection changes
  useEffect(() => {
    if (selectedCollectionId) {
      loadFields(selectedCollectionId);
      loadItems(selectedCollectionId, 1, pageSize); // Always load page 1 when collection changes
      // Clear selections and search when switching collections
      setSelectedItemIds(new Set());
      setSearchQuery('');
      setFieldSearchQuery('');
      setCurrentPage(1); // Reset to page 1
    }
  }, [selectedCollectionId, loadFields, loadItems, pageSize]);

  // Debounced field search - queries backend
  useEffect(() => {
    if (!selectedCollectionId) return;

    const debounceTimer = setTimeout(() => {
      loadFields(selectedCollectionId, fieldSearchQuery || undefined);
    }, 300); // 300ms debounce

    return () => clearTimeout(debounceTimer);
  }, [fieldSearchQuery, selectedCollectionId, loadFields]);

  // Debounced search - queries backend with pagination
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
  }, [searchQuery, selectedCollectionId, currentPage, pageSize, searchItems, loadItems]);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Reset to page 1 when sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCollection?.sorting]);

  // Reset to page 1 when page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  // Update form when editing item or collection fields change
  useEffect(() => {
    if (editingItem) {
      form.reset(editingItem.values);
    } else {
      // Reset with default values from fields
      const defaults: Record<string, any> = {};
      collectionFields.forEach(field => {
        // Always set a value (use default or empty string) to avoid undefined
        defaults[field.id] = field.default || '';
      });
      form.reset(defaults);
    }
  }, [editingItem, collectionFields, form]);

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

  const handleCreateItem = () => {
    setEditingItem(null);
    setShowItemSheet(true);
  };

  const handleEditItem = (item: CollectionItemWithValues) => {
    setEditingItem(item);
    setShowItemSheet(true);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedCollectionId) return;

    if (confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteItem(selectedCollectionId, itemId);
      } catch (error) {
        console.error('Failed to delete item:', error);
      }
    }
  };

  const handleDuplicateItem = async (itemId: string) => {
    if (!selectedCollectionId) return;

    try {
      await duplicateItem(selectedCollectionId, itemId);
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
    if (field?.built_in) {
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
      // Reload fields to show new field
      await loadFields(selectedCollectionId);
    } catch (error) {
      console.error('Failed to duplicate field:', error);
    }
  };

  const handleToggleFieldVisibility = async (fieldId: string) => {
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

  const handleReorderFields = async (reorderedFields: CollectionField[]) => {
    if (!selectedCollectionId) return;

    try {
      const fieldIds = reorderedFields.map(f => f.id);
      await collectionsApi.reorderFields(selectedCollectionId, fieldIds);
      // Reload fields to show new order
      await loadFields(selectedCollectionId);
    } catch (error) {
      console.error('Failed to reorder fields:', error);
    }
  };

  const handleCreateFieldFromPopover = async (data: {
    name: string;
    type: FieldType;
    default: string;
  }) => {
    if (!selectedCollectionId) return;

    try {
      const newOrder = collectionFields.length;

      await createField(selectedCollectionId, {
        name: data.name,
        type: data.type,
        default: data.default || null,
        order: newOrder,
        fillable: true,
        built_in: false,
        hidden: false,
      });

      // Reload fields to show new field
      await loadFields(selectedCollectionId);

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
  }) => {
    if (!selectedCollectionId || !editingField) return;

    try {
      await updateField(selectedCollectionId, editingField.id, {
        name: data.name,
        default: data.default || null,
      });

      // Reload fields to show updated field
      await loadFields(selectedCollectionId);

      // Close dialog and reset
      setEditFieldDialogOpen(false);
      setEditingField(null);
    } catch (error) {
      console.error('Failed to update field:', error);
    }
  };

  const handleSheetSubmit = async (values: Record<string, any>) => {
    if (!selectedCollectionId) return;

    try {
      if (editingItem) {
        // Update existing item
        await collectionsApi.updateItem(selectedCollectionId, editingItem.id, values);
      } else {
        // Create new item
        await collectionsApi.createItem(selectedCollectionId, values);
      }

      // Reload items
      await loadItems(selectedCollectionId, currentPage, pageSize);

      // Close sheet and reset
      setShowItemSheet(false);
      setEditingItem(null);
      form.reset();
    } catch (error) {
      console.error('Failed to save item:', error);
      alert('Failed to save item. Please try again.');
    }
  };

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

  // Loading
  if (isLoading) {
    return (
      <div className="flex-1 bg-background flex items-center justify-center">
        <Spinner />
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
            >
              <Icon name="trash" />
              Delete ({selectedItemIds.size})
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
            disabled={collectionFields.length === 0}
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
              onSubmit={handleCreateFieldFromPopover}
              open={createFieldPopoverOpen}
              onOpenChange={setCreateFieldPopoverOpen}
            />
          </div>
        ) : (
          <>
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
                                onClick={() => handleColumnClick(field.id)}
                                className="flex items-center gap-1 hover:opacity-50 cursor-pointer"
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
                                onOpenChange={(open) => setOpenDropdownId(open ? field.id : null)}
                              >
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    className="-my-2"
                                  >
                                    <Icon name="more" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem
                                    onSelect={() => handleEditFieldClick(field)}
                                    disabled={field.built_in}
                                  >
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDuplicateField(field.id)}
                                    disabled={field.built_in}
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
                                    disabled={field.built_in}
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
                            <Button size="sm" variant="ghost">
                              <Icon name="plus" />
                              Add field
                            </Button>
                          }
                          mode="create"
                          onSubmit={handleCreateFieldFromPopover}
                          open={createFieldPopoverOpen}
                          onOpenChange={setCreateFieldPopoverOpen}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.length > 0 ? (
                      sortedItems.map((item) => (
                        <SortableRow
                          key={item.id}
                          item={item}
                          isManualMode={isManualMode}
                          onDuplicate={() => handleDuplicateItem(item.id)}
                          onDelete={() => handleDeleteItem(item.id)}
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

            <div>
              <div>
                <Sheet open={showItemSheet} onOpenChange={setShowItemSheet}>
                  <SheetTrigger asChild>
                    <div className="group">
                      <div className="grid grid-flow-col text-muted-foreground group-hover:bg-secondary/50">
                        <div className="px-4 py-4">
                          <Button size="xs" variant="ghost">
                            <Icon name="plus" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>
                        {editingItem ? 'Edit' : 'Create'} {selectedCollection?.name} Item
                      </SheetTitle>
                      <SheetActions>
                        <Button
                          size="sm"
                          type="submit"
                          form="collection-item-form"
                        >
                          {editingItem ? 'Save' : 'Create'}
                        </Button>
                      </SheetActions>
                    </SheetHeader>

                    <Form {...form}>
                      <form
                        id="collection-item-form"
                        onSubmit={form.handleSubmit(handleSheetSubmit)}
                        className="flex flex-col gap-4 flex-1 mt-6"
                      >
                        <div className="flex-1 flex flex-col gap-6">
                          {collectionFields
                            .filter(f => f.fillable && !f.hidden)
                            .map((field) => (
                              <FormField
                                key={field.id}
                                control={form.control}
                                name={field.id}
                                render={({ field: formField }) => (
                                  <FormItem>
                                    <FormLabel>{field.name}</FormLabel>
                                    <FormControl>
                                      {field.type === 'rich_text' ? (
                                        <TiptapEditor
                                          value={formField.value || ''}
                                          onChange={formField.onChange}
                                          placeholder={field.default || `Enter ${field.name.toLowerCase()}...`}
                                        />
                                      ) : (
                                        <Input
                                          placeholder={field.default || `Enter ${field.name.toLowerCase()}...`}
                                          {...formField}
                                        />
                                      )}
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            ))}
                        </div>
                      </form>
                    </Form>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {/* Pagination Controls */}
            {selectedCollectionId && sortedItems.length > 0 && (
              <div className="flex items-center justify-between px-4 py-4 border-t mt-auto">

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Show:</span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => setPageSize(Number(value))}
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
                </div>

                <div className="flex items-center gap-4">
                  <p className="text-xs text-muted-foreground">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} results
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage * pageSize >= totalItems}
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
}

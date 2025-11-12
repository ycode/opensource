/**
 * CMS Component
 *
 * Content Management System interface for managing collection items with EAV architecture.
 */
'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { collectionsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import CollectionItemDialog from './CollectionItemDialog';
import AddFieldDialog from './AddFieldDialog';
import FieldsDropdown from './FieldsDropdown';
import CollectionItemContextMenu from './CollectionItemContextMenu';
import type { CollectionItemWithValues, CollectionField } from '@/types';

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
  } = useCollectionsStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [showAddFieldDialog, setShowAddFieldDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<CollectionItemWithValues | null>(null);
  const [editingField, setEditingField] = useState<CollectionField | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  
  const selectedCollection = collections.find(c => c.id === selectedCollectionId);
  const collectionFields = selectedCollectionId ? (fields[selectedCollectionId] || []) : [];
  const collectionItems = selectedCollectionId ? (items[selectedCollectionId] || []) : [];
  
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
      loadItems(selectedCollectionId);
      // Clear selections when switching collections
      setSelectedItemIds(new Set());
    }
  }, [selectedCollectionId, loadFields, loadItems]);
  
  // Filter and sort items
  const filteredItems = React.useMemo(() => {
    // First, filter items based on search
    let items = collectionItems.filter(item => {
      if (!searchQuery) return true;
      
      const searchLower = searchQuery.toLowerCase();
      return Object.values(item.values).some(value => 
        String(value).toLowerCase().includes(searchLower)
      );
    });
    
    // Then, apply sorting
    const sorting = selectedCollection?.sorting;
    if (sorting) {
      items = [...items].sort((a, b) => {
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
      items = [...items].sort((a, b) => a.manual_order - b.manual_order);
    }
    
    return items;
  }, [collectionItems, searchQuery, selectedCollection?.sorting]);
  
  const handleCreateItem = () => {
    setEditingItem(null);
    setShowItemDialog(true);
  };
  
  const handleEditItem = (item: CollectionItemWithValues) => {
    setEditingItem(item);
    setShowItemDialog(true);
  };
  
  const handleDeleteItem = async (itemId: number) => {
    if (!selectedCollectionId) return;
    
    if (confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteItem(selectedCollectionId, itemId);
      } catch (error) {
        console.error('Failed to delete item:', error);
      }
    }
  };

  const handleDuplicateItem = async (itemId: number) => {
    if (!selectedCollectionId) return;
    
    try {
      await duplicateItem(selectedCollectionId, itemId);
    } catch (error) {
      console.error('Failed to duplicate item:', error);
    }
  };

  const handleColumnClick = async (fieldName: string) => {
    if (!selectedCollectionId || !selectedCollection) return;
    
    const currentSorting = selectedCollection.sorting;
    let newSorting;
    
    // Cycle through: manual → asc → desc → manual
    if (!currentSorting || currentSorting.field !== fieldName) {
      // First click on this field - set to manual mode
      newSorting = { field: fieldName, direction: 'manual' as const };
    } else if (currentSorting.direction === 'manual') {
      // Second click - set to ASC
      newSorting = { field: fieldName, direction: 'asc' as const };
    } else if (currentSorting.direction === 'asc') {
      // Third click - set to DESC
      newSorting = { field: fieldName, direction: 'desc' as const };
    } else {
      // Fourth click - back to manual mode
      newSorting = { field: fieldName, direction: 'manual' as const };
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
    const oldIndex = filteredItems.findIndex(item => item.id === active.id);
    const newIndex = filteredItems.findIndex(item => item.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    // Reorder the items array
    const reorderedItems = [...filteredItems];
    const [movedItem] = reorderedItems.splice(oldIndex, 1);
    reorderedItems.splice(newIndex, 0, movedItem);
    
    // Calculate new manual_order values for all affected items
    const updates = reorderedItems.map((item, index) => ({
      id: item.id,
      manual_order: index,
    }));
    
    try {
      await reorderItems(selectedCollectionId, updates);
    } catch (error) {
      console.error('Failed to reorder items:', error);
    }
  };
  
  const handleToggleItemSelection = (itemId: number) => {
    const newSelected = new Set(selectedItemIds);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItemIds(newSelected);
  };
  
  const handleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length) {
      // Deselect all
      setSelectedItemIds(new Set());
    } else {
      // Select all
      setSelectedItemIds(new Set(filteredItems.map(item => item.id)));
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
  
  const handleEditField = (field: CollectionField) => {
    setEditingField(field);
    setShowAddFieldDialog(true);
  };
  
  const handleDeleteField = async (fieldId: number) => {
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
  
  const handleHideField = async (fieldId: number) => {
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
  
  const handleDuplicateField = async (fieldId: number) => {
    if (!selectedCollectionId) return;
    
    const field = collectionFields.find(f => f.id === fieldId);
    if (!field) return;
    
    try {
      const newOrder = collectionFields.length;
      await createField(selectedCollectionId, {
        name: `${field.name} (Copy)`,
        field_name: `${field.field_name}_copy`,
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
  
  const handleToggleFieldVisibility = async (fieldId: number) => {
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
  
  
  const handleDialogSuccess = () => {
    if (selectedCollectionId) {
      loadItems(selectedCollectionId);
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
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-4 flex-1">
          <div className="max-w-md flex-1">
            <Input 
              placeholder="Search items..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="sm"
            />
          </div>
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
          <Button 
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditingField(null);
              setShowAddFieldDialog(true);
            }}
          >
            <Icon name="plus" />
            Add Field
          </Button>
          <FieldsDropdown
            fields={collectionFields}
            onToggleVisibility={handleToggleFieldVisibility}
            onReorder={handleReorderFields}
          />
          <Button 
            size="sm" 
            onClick={handleCreateItem}
            disabled={collectionFields.length === 0}
          >
            <Icon name="plus" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Items Content */}
      <div className="flex-1 overflow-auto">
        {collectionFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 p-8">
            <Empty>
              <EmptyTitle>No Fields Defined</EmptyTitle>
              <EmptyDescription>
                This collection has no fields. Add fields to start managing items.
              </EmptyDescription>
            </Empty>
            <Button
              onClick={() => {
                setEditingField(null);
                setShowAddFieldDialog(true);
              }}
            >
              <Icon name="plus" />
              Add Field
            </Button>
          </div>
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredItems.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <table className="w-full">
                  <thead className="border-b sticky top-0 bg-background">
                    <tr>
                      <th className="px-4 py-3 w-12">
                        <input
                          type="checkbox"
                          checked={filteredItems.length > 0 && selectedItemIds.size === filteredItems.length}
                          onChange={handleSelectAll}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </th>
                      {collectionFields.filter(f => !f.hidden).map((field) => {
                        const sorting = selectedCollection?.sorting;
                        const isActiveSort = sorting?.field === field.field_name;
                        const sortIcon = isActiveSort ? (
                          sorting.direction === 'manual' ? 'M' :
                            sorting.direction === 'asc' ? '↑' :
                              '↓'
                        ) : null;
                        
                        return (
                          <th key={field.id} className="px-4 py-3 text-left font-medium text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleColumnClick(field.field_name)}
                                className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                              >
                                {field.name}
                                {sortIcon && (
                                  <span className="text-xs font-mono">
                                    {sortIcon}
                                  </span>
                                )}
                              </button>
                              <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="xs" variant="ghost"
                              className="h-auto p-0 hover:bg-transparent"
                            >
                              <span className="text-muted-foreground">...</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem 
                              onClick={() => handleEditField(field)}
                              disabled={field.built_in}
                            >
                              <Icon name="pencil" className="mr-2 h-3 w-3" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDuplicateField(field.id)}
                              disabled={field.built_in}
                            >
                              <Icon name="copy" className="mr-2 h-3 w-3" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleHideField(field.id)}
                              disabled={field.field_name === 'name'}
                            >
                              <Icon name={field.hidden ? 'eye' : 'eye-off'} className="mr-2 h-3 w-3" />
                              {field.hidden ? 'Show' : 'Hide'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteField(field.id)}
                              disabled={field.built_in}
                              className="text-destructive"
                            >
                              <Icon name="trash" className="mr-2 h-3 w-3" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </th>
                        );
                      })}
                </tr>
              </thead>
              <tbody>
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item) => (
                        <SortableRow
                          key={item.id}
                          item={item}
                          isManualMode={isManualMode}
                          onDuplicate={() => handleDuplicateItem(item.id)}
                          onDelete={() => handleDeleteItem(item.id)}
                        >
                          <td
                            className="px-4 py-3 w-12" onClick={(e) => {
                              e.stopPropagation();
                              if (!isManualMode) {
                                handleEditItem(item);
                              }
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedItemIds.has(item.id)}
                              onChange={() => handleToggleItemSelection(item.id)}
                              className="w-4 h-4 cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          {collectionFields.filter(f => !f.hidden).map((field) => {
                            const value = item.values[field.field_name];
                            
                            // Format date fields
                            if (field.type === 'date' && value) {
                              return (
                                <td
                                  key={field.id} className="px-4 py-3"
                                  onClick={() => !isManualMode && handleEditItem(item)}
                                >
                                  {formatDate(value, 'MMM D YYYY, HH:mm')}
                                </td>
                              );
                            }
                            
                            return (
                              <td
                                key={field.id} className="px-4 py-3"
                                onClick={() => !isManualMode && handleEditItem(item)}
                              >
                                {value || '-'}
                              </td>
                            );
                          })}
                        </SortableRow>
                      ))
                    ) : (
                  <tr>
                    <td colSpan={collectionFields.filter(f => !f.hidden).length + 1} className="px-4 py-8 text-center">
                      {searchQuery && collectionItems.length > 0 ? (
                        <div className="text-muted-foreground">
                          No items found matching &quot;{searchQuery}&quot;
                        </div>
                      ) : (
                        <Empty>
                          <EmptyTitle>No Items Yet</EmptyTitle>
                          <EmptyDescription>
                            Click &quot;Add Item&quot; to create your first {selectedCollection?.name.toLowerCase()} item
                          </EmptyDescription>
                        </Empty>
                      )}
                    </td>
                  </tr>
                    )}
              </tbody>
            </table>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>
      
      {/* Add Field Dialog */}
      {selectedCollectionId && (
        <AddFieldDialog
          isOpen={showAddFieldDialog}
          onClose={() => {
            setShowAddFieldDialog(false);
            setEditingField(null);
          }}
          collectionId={selectedCollectionId}
          field={editingField}
          onSuccess={() => {
            if (selectedCollectionId) {
              loadFields(selectedCollectionId);
            }
          }}
        />
      )}
      
      {/* Item Dialog */}
      {selectedCollectionId && (
        <CollectionItemDialog
          isOpen={showItemDialog}
          onClose={() => {
            setShowItemDialog(false);
            setEditingItem(null);
          }}
          collectionId={selectedCollectionId}
          item={editingItem}
          onSuccess={handleDialogSuccess}
        />
      )}
    </div>
  );
}

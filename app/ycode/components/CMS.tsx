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
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { collectionsApi } from '@/lib/api';
import CollectionItemDialog from './CollectionItemDialog';
import AddFieldDialog from './AddFieldDialog';
import FieldsDropdown from './FieldsDropdown';
import type { CollectionItemWithValues, CollectionField } from '@/types';

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
    deleteField,
    updateField,
    createField,
  } = useCollectionsStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [showAddFieldDialog, setShowAddFieldDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<CollectionItemWithValues | null>(null);
  
  const selectedCollection = collections.find(c => c.id === selectedCollectionId);
  const collectionFields = selectedCollectionId ? (fields[selectedCollectionId] || []) : [];
  const collectionItems = selectedCollectionId ? (items[selectedCollectionId] || []) : [];
  
  // Load fields and items when collection changes
  useEffect(() => {
    if (selectedCollectionId) {
      loadFields(selectedCollectionId);
      loadItems(selectedCollectionId);
    }
  }, [selectedCollectionId, loadFields, loadItems]);
  
  // Filter items based on search
  const filteredItems = collectionItems.filter(item => {
    if (!searchQuery) return true;
    
    const searchLower = searchQuery.toLowerCase();
    return Object.values(item.values).some(value => 
      String(value).toLowerCase().includes(searchLower)
    );
  });
  
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
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">
            {selectedCollection?.name}
          </h2>
          <div className="max-w-xs flex-1">
            <Input 
              placeholder="Search items..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="sm"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            size="sm"
            variant="secondary"
            onClick={() => setShowAddFieldDialog(true)}
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
            <Button onClick={() => setShowAddFieldDialog(true)}>
              <Icon name="plus" />
              Add Field
            </Button>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="border-b sticky top-0 bg-background">
                <tr>
                  {collectionFields.filter(f => !f.hidden).map((field) => (
                    <th key={field.id} className="px-4 py-3 text-left font-medium text-sm">
                      <div className="flex items-center gap-2">
                        {field.name}
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
                            <DropdownMenuItem disabled={field.built_in}>
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
                  ))}
                  <th className="px-4 py-3 text-left font-medium text-sm w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <tr 
                      key={item.id} 
                      className="group border-b hover:bg-secondary/50 transition-colors cursor-pointer"
                      onClick={() => handleEditItem(item)}
                    >
                      {collectionFields.filter(f => !f.hidden).map((field) => (
                        <td key={field.id} className="px-4 py-3">
                          {item.values[field.field_name] || '-'}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditItem(item);
                            }}
                          >
                            <Icon name="pencil" />
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item.id);
                            }}
                          >
                            <Icon name="trash" />
                          </Button>
                        </div>
                      </td>
                    </tr>
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
          </>
        )}
      </div>
      
      {/* Add Field Dialog */}
      {selectedCollectionId && (
        <AddFieldDialog
          isOpen={showAddFieldDialog}
          onClose={() => setShowAddFieldDialog(false)}
          collectionId={selectedCollectionId}
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

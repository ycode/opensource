/**
 * Fields Dropdown
 * 
 * Dropdown menu for managing field visibility and order
 */
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import type { CollectionField } from '@/types';

interface FieldsDropdownProps {
  fields: CollectionField[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleVisibility: (fieldId: number) => void;
  onReorder: (fields: CollectionField[]) => void;
}

export default function FieldsDropdown({
  fields,
  searchQuery,
  onSearchChange,
  onToggleVisibility,
  onReorder,
}: FieldsDropdownProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [orderedFields, setOrderedFields] = useState<CollectionField[]>(
    [...fields].sort((a, b) => a.order - b.order)
  );

  // Update ordered fields when fields prop changes
  React.useEffect(() => {
    setOrderedFields([...fields].sort((a, b) => a.order - b.order));
  }, [fields]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === index) return;

    const newFields = [...orderedFields];
    const draggedField = newFields[draggedIndex];
    
    // Remove from old position
    newFields.splice(draggedIndex, 1);
    // Insert at new position
    newFields.splice(index, 0, draggedField);
    
    setOrderedFields(newFields);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    // Update order values based on new positions
    const reorderedFields = orderedFields.map((field, index) => ({
      ...field,
      order: index,
    }));
    
    onReorder(reorderedFields);
    setDraggedIndex(null);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary">
          <Icon name="columns" />
          Fields
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="p-2">
          <div 
            className="mb-2"
            onKeyDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Input
              placeholder="Search fields..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              size="sm"
              className="h-8"
            />
          </div>
          <div className="text-xs font-medium mb-2 text-muted-foreground">
            Show/Hide & Reorder Fields
          </div>
          <div className="flex flex-col gap-1">
            {orderedFields.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                No fields found
              </div>
            ) : (
              orderedFields.map((field, index) => (
                <div
                  key={field.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center justify-between gap-2 p-2 rounded hover:bg-secondary/50 cursor-move transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Icon name="grip-vertical" className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{field.name}</span>
                  </div>
                  <Switch
                    checked={!field.hidden}
                    onCheckedChange={() => onToggleVisibility(field.id)}
                    disabled={field.field_name === 'name'}
                    className="flex-shrink-0"
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}





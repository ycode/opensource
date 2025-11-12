/**
 * Collection Item Dialog
 * 
 * Dialog for creating/editing collection items with dynamic form based on fields.
 */
'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { slugify } from '@/lib/collection-utils';
import type { CollectionField, CollectionItemWithValues } from '@/types';

interface CollectionItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: number;
  item?: CollectionItemWithValues | null;
  onSuccess?: () => void;
}

export default function CollectionItemDialog({
  isOpen,
  onClose,
  collectionId,
  item,
  onSuccess,
}: CollectionItemDialogProps) {
  const { fields, createItem, updateItem, isLoading } = useCollectionsStore();
  const [values, setValues] = useState<Record<string, any>>({});
  
  const collectionFields = fields[collectionId] || [];
  
  // Initialize values from item if editing, or with default values if creating
  useEffect(() => {
    if (item) {
      setValues(item.values || {});
    } else {
      // Pre-populate with default values for new items
      const defaultValues: Record<string, any> = {};
      collectionFields.forEach(field => {
        if (field.default) {
          defaultValues[field.field_name] = field.default;
        }
      });
      setValues(defaultValues);
    }
  }, [item, collectionFields]);
  
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    try {
      if (item) {
        // Update existing item (preserves existing status)
        await updateItem(collectionId, item.id, values);
      } else {
        // Create new item (defaults to 'draft' status in API)
        await createItem(collectionId, values);
      }
      
      // Reset and close
      setValues({});
      onClose();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to save item:', error);
    }
  };
  
  const handleClose = () => {
    setValues({});
    onClose();
  };
  
  const handleFieldChange = (fieldName: string, value: any) => {
    const newValues = { ...values, [fieldName]: value };
    
    // Auto-populate slug from name only when creating (not editing)
    if (!item && fieldName === 'name' && typeof value === 'string') {
      newValues['slug'] = slugify(value);
    }
    
    setValues(newValues);
  };
  
  const renderFieldInput = (field: CollectionField) => {
    const value = values[field.field_name] || field.default || '';
    
    switch (field.type) {
      case 'text':
        return (
          <Input
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            placeholder={field.default || ''}
          />
        );
        
      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            placeholder={field.default || '0'}
          />
        );
        
      case 'boolean':
        return (
          <Switch
            checked={value === 'true' || value === true}
            onCheckedChange={(checked) => handleFieldChange(field.field_name, checked)}
          />
        );
        
      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
          />
        );
        
      case 'reference':
        // For reference fields, we'd need to load items from the referenced collection
        // Simplified version for now
        return (
          <Input
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            placeholder="Reference ID"
          />
        );
        
      default:
        return (
          <Input
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
          />
        );
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent variant="side" showCloseButton={false}>
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle>{item ? 'Edit Item' : 'Create Item'}</DialogTitle>
          <div className="flex gap-2">
            <Button
              type="button" variant="secondary"
              onClick={handleClose} size="sm"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || collectionFields.filter(f => f.fillable).length === 0}
              size="sm"
              onClick={handleSubmit}
            >
              Save
            </Button>
          </div>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 flex-1">
            <div className="flex-1 flex flex-col gap-4">
              {collectionFields
                .filter(f => !f.hidden && f.fillable && f.field_name !== 'status') // Exclude status field from modal
                .map((field) => (
                  <div key={field.id} className="flex flex-col gap-2">
                    <Label>{field.name}</Label>
                    {renderFieldInput(field)}
                  </div>
                ))}
              
              {collectionFields.filter(f => !f.hidden && f.fillable && f.field_name !== 'status').length === 0 && (
                <div className="text-muted-foreground text-sm">
                  No fields defined for this collection. Add fields first.
                </div>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}


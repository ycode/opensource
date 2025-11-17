/**
 * Add Field Dialog
 *
 * Dialog for adding or editing a field in a collection.
 */
'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { slugify } from '@/lib/collection-utils';
import type { CollectionFieldType, CollectionField } from '@/types';

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Name must be at least 2 characters.',
  }),
  type: z.enum(['text', 'number', 'boolean', 'date', 'reference', 'rich_text'], {
    message: 'Please select a field type.',
  }),
  default: z.string().optional(),
});

interface AddFieldDialogProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: number;
  field?: CollectionField | null; // Optional field for editing
  onSuccess?: () => void;
}

export default function AddFieldDialog({
  isOpen,
  onClose,
  collectionId,
  field,
  onSuccess,
}: AddFieldDialogProps) {
  const { createField, updateField, isLoading, fields } = useCollectionsStore();
  const isEditMode = !!field;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: field?.name || '',
      type: field?.type || 'text',
      default: field?.default || '',
    },
  });

  // Update form when field changes
  useEffect(() => {
    if (field) {
      form.reset({
        name: field.name,
        type: field.type,
        default: field.default || '',
      });
    } else {
      form.reset({
        name: '',
        type: 'text',
        default: '',
      });
    }
  }, [field, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (isEditMode && field) {
        // Edit existing field - update name and default value
        await updateField(collectionId, field.id, {
          name: values.name,
          default: values.default || null,
        });
      } else {
        // Create new field
        const collectionFields = fields[collectionId] || [];
        const order = collectionFields.length; // Place new field at the end

        await createField(collectionId, {
          name: values.name,
          field_name: slugify(values.name).replace(/-/g, '_'), // Use underscores for field names
          type: values.type as CollectionFieldType,
          default: values.default || null,
          order,
          built_in: false, // User-created fields are not built-in
          fillable: true,
          hidden: false,
        });
      }

      // Reset form
      form.reset();

      // Close dialog
      onClose();

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} field:`, error);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Field x' : 'Add Field'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Field Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Field Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isEditMode}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="rich_text">Rich Text</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="boolean">Boolean (Yes/No)</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="reference">Reference (Link to another collection)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="default"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Value (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter default value..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button" variant="secondary"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Field' : 'Add Field')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


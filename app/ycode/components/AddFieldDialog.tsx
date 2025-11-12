/**
 * Add Field Dialog
 * 
 * Dialog for adding a new field to a collection.
 */
'use client';

import React from 'react';
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
import type { CollectionFieldType } from '@/types';

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Name must be at least 2 characters.',
  }),
  type: z.enum(['text', 'number', 'boolean', 'date', 'reference'], {
    message: 'Please select a field type.',
  }),
});

interface AddFieldDialogProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: number;
  onSuccess?: () => void;
}

export default function AddFieldDialog({
  isOpen,
  onClose,
  collectionId,
  onSuccess,
}: AddFieldDialogProps) {
  const { createField, isLoading, fields } = useCollectionsStore();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      type: 'text',
    },
  });
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      // Auto-generate field_name from name
      const collectionFields = fields[collectionId] || [];
      const order = collectionFields.length; // Place new field at the end
      
      await createField(collectionId, {
        name: values.name,
        field_name: slugify(values.name).replace(/-/g, '_'), // Use underscores for field names
        type: values.type as CollectionFieldType,
        order,
        built_in: false, // User-created fields are not built-in
        fillable: true,
        hidden: false,
      });
      
      // Reset form
      form.reset();
      
      // Close dialog
      onClose();
      
      // Call success callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to create field:', error);
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
          <DialogTitle>Add Field</DialogTitle>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="text">Text</SelectItem>
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
            
            <DialogFooter>
              <Button
                type="button" variant="secondary"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Adding...' : 'Add Field'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


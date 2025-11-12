/**
 * Create Collection Dialog
 * 
 * Dialog for creating a new collection with auto-generated slug from name.
 */
'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { slugify } from '@/lib/collection-utils';

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Name must be at least 2 characters.',
  }),
});

interface CreateCollectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (collectionId: number) => void;
}

export default function CreateCollectionDialog({
  isOpen,
  onClose,
  onSuccess,
}: CreateCollectionDialogProps) {
  const { createCollection, isLoading } = useCollectionsStore();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
    },
  });
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      // Auto-generate collection_name from name
      const collectionData = {
        name: values.name,
        collection_name: slugify(values.name),
      };
      
      const newCollection = await createCollection(collectionData);
      
      // Reset form
      form.reset();
      
      // Close dialog
      onClose();
      
      // Call success callback with new collection ID
      if (onSuccess) {
        onSuccess(newCollection.id);
      }
    } catch (error) {
      console.error('Failed to create collection:', error);
      // Error is already handled in the store
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
          <DialogTitle>Create Collection</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collection Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Blog Posts" {...field} />
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
                {isLoading ? 'Creating...' : 'Create Collection'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


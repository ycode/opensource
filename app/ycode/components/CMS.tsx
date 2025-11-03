/**
 * CMS Component
 *
 * Content Management System interface for managing site content
 */
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Name must be at least 2 characters.',
  }),
  slug: z.string().min(2, {
    message: 'Slug must be at least 2 characters.',
  }).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens only.',
  }),
});

export default function CMS() {
  const [activeSection, setActiveSection] = useState<'content' | 'media' | 'settings'>('content');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      slug: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    setIsDialogOpen(false);
    form.reset();
  }

  return (
    <div className="flex-1 bg-background flex flex-col">

        <div className="p-4 flex">

            <div className="w-full max-w-72">
                <Input placeholder="Search..." />
            </div>

        </div>

        <hr />

        <div>

            <div className="grid grid-flow-col border-b">
                <div className="px-4 py-5">
                    <span>Name</span>
                </div>
                <div className="px-4 py-5">
                    <span>Slug</span>
                </div>
            </div>

            <div className="group">
                <div className="grid grid-flow-col text-muted-foreground group-hover:bg-secondary">
                    <div className="px-4 py-5">
                        <span>My first blog post</span>
                    </div>
                    <div className="px-4 py-5">
                        <span>my-first-blog-post</span>
                    </div>
                </div>
                <hr className="ml-4" />
            </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <div className="group">
                <div className="grid grid-flow-col text-muted-foreground group-hover:bg-secondary">
                  <div className="px-4 py-5">
                    <Button size="xs" variant="ghost">
                      <Icon name="plus" />
                    </Button>
                  </div>
                </div>
              </div>
            </DialogTrigger>
            <DialogContent variant="side">
              <DialogHeader>
                <DialogTitle>Collection item</DialogTitle>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 flex-1">
                  <div className="flex-1 flex flex-col gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="My first blog post" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slug</FormLabel>
                          <FormControl>
                            <Input placeholder="my-first-blog-post" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/*<DialogFooter>*/}
                  {/*  <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>*/}
                  {/*    Cancel*/}
                  {/*  </Button>*/}
                  {/*  <Button type="submit">*/}
                  {/*    Create*/}
                  {/*  </Button>*/}
                  {/*</DialogFooter>*/}
                </form>
              </Form>
            </DialogContent>
          </Dialog>

        </div>

    </div>
  );
}

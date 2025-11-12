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
  Sheet, SheetActions,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePagesStore } from '@/stores/usePagesStore';
import { Spinner } from '@/components/ui/spinner';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger
} from '@/components/ui/select';
import { TiptapEditor } from '@/components/ui/tiptap-editor';

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Name must be at least 2 characters.',
  }),
  slug: z.string().min(2, {
    message: 'Slug must be at least 2 characters.',
  }).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens only.',
  }),
  content: z.string().min(1, {
    message: 'Content is required.',
  }),
});

export default function CMS() {
  const [activeSection, setActiveSection] = useState<'content' | 'media' | 'settings'>('content');
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      slug: '',
      content: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    setIsSheetOpen(false);
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

        <div className="overflow-x-auto">

            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="px-4 py-5 text-left font-normal">
                    <span>Name</span>
                  </th>
                  <th className="px-4 py-5 text-left font-normal">
                    <span>Slug</span>
                  </th>
                  <th className="px-4 py-5 text-left font-normal w-24">
                    <div className="-my-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <Icon name="plus" />
                            Add field
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="mr-4">
                          <div className="flex flex-col gap-3">
                            <div className="grid grid-cols-3">
                              <Label variant="muted">Name</Label>
                              <div className="col-span-2 *:w-full">
                                <Input />
                              </div>
                            </div>
                            <div className="grid grid-cols-3">
                              <Label variant="muted">Type</Label>
                              <div className="col-span-2 *:w-full">
                                <Select>
                                  <SelectTrigger>
                                    Text
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      <SelectItem value="1">Text</SelectItem>
                                      <SelectItem value="2">Link</SelectItem>
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                            >
                              Create field
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="group border-b hover:bg-secondary">
                  <td className="px-4 py-5 text-muted-foreground">
                    <span>My first blog post</span>
                  </td>
                  <td className="px-4 py-5 text-muted-foreground">
                    <span>my-first-blog-post</span>
                  </td>
                  <td className="px-4 py-5"></td>
                </tr>
              </tbody>
            </table>

        </div>

        <div>

            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <div className="group">
                <div className="grid grid-flow-col text-muted-foreground group-hover:bg-secondary">
                  <div className="px-4 py-5">
                    <Button size="xs" variant="ghost">
                      <Icon name="plus" />
                    </Button>
                  </div>
                </div>
              </div>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Collection item</SheetTitle>
                <SheetActions>
                    <Button
                      size="sm"
                      type="submit"
                    >
                      Create
                    </Button>
                  </SheetActions>
              </SheetHeader>

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

                    <FormField
                      control={form.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Content</FormLabel>
                          <FormControl>
                            <TiptapEditor
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Write your content here..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>


                </form>
              </Form>
            </SheetContent>
          </Sheet>

        </div>

    </div>
  );
}

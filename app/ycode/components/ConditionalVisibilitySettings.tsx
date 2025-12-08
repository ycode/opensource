'use client';

/**
 * Conditional Visibility Settings Component
 *
 * Settings panel for conditional visibility based on field values
 */

import React, { useState } from 'react';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SettingsPanel from './SettingsPanel';
import type { Layer, CollectionField } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

interface ConditionalVisibilitySettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  fields?: CollectionField[];
  fieldSourceLabel?: string;
}

export default function ConditionalVisibilitySettings({
  layer,
  onLayerUpdate,
  fields,
  fieldSourceLabel,
}: ConditionalVisibilitySettingsProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!layer) {
    return null;
  }

  return (
    <SettingsPanel
      title="Conditional visibility"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      action={
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="xs"
          >
            <Icon name="plus" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="!max-h-[300px]"
        >
          <DropdownMenuItem>Name</DropdownMenuItem>
          <DropdownMenuItem>Slug</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      }
    >

      <div className="flex flex-col gap-2">

        <div className="flex flex-col bg-muted rounded-lg">

          <ul className="p-2 flex flex-col gap-2">

            <li className="*:w-full flex flex-col gap-2">

              <header className="flex items-center gap-1.5">
                <div className="size-5 flex items-center justify-center rounded-[6px] bg-secondary/50 hover:bg-secondary/100">
                  <Icon name="text" className="size-2.5 opacity-60" />
                </div>
                <Label variant="muted">Homepage</Label>

                <div className="ml-auto -my-1 -mr-0.5">
                  <Button size="xs" variant="ghost">
                    <Icon name="x" />
                  </Button>
                </div>
              </header>

              <Select>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a condition..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="1">is</SelectItem>
                    <SelectItem value="2">is not</SelectItem>
                    <SelectItem value="3">contains</SelectItem>
                    <SelectItem value="4">does not contain</SelectItem>
                    <SelectItem value="5">is present</SelectItem>
                    <SelectItem value="6">is empty</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Input placeholder="Enter value..." />

            </li>

            <li className="flex items-center gap-2 h-6">
              <Label variant="muted" className="text-[10px]">Or</Label>
              <hr className="flex-1" />
            </li>

            <li className="*:w-full flex flex-col gap-2">

              <header className="flex items-center gap-1.5">
                <div className="size-5 flex items-center justify-center rounded-[6px] bg-secondary/50 hover:bg-secondary/100">
                  <Icon name="text" className="size-2.5 opacity-60" />
                </div>
                <Label variant="muted">Homepage</Label>

                <div className="ml-auto -my-1 -mr-0.5">
                  <Button size="xs" variant="ghost">
                    <Icon name="x" />
                  </Button>
                </div>
              </header>

              <Select>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a condition..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="1">is</SelectItem>
                    <SelectItem value="2">is not</SelectItem>
                    <SelectItem value="3">contains</SelectItem>
                    <SelectItem value="4">does not contain</SelectItem>
                    <SelectItem value="5">is present</SelectItem>
                    <SelectItem value="6">is empty</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Input placeholder="Enter value..." />

            </li>

            <li className="flex items-center gap-2 h-6">
              <Label variant="muted" className="text-[10px]">Or</Label>
              <hr className="flex-1" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="size-5"
                  >
                    <div>
                      <Icon name="plus" className="!size-2.5" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="!max-h-[300px]"
                >
                  <DropdownMenuItem>Name</DropdownMenuItem>
                  <DropdownMenuItem>Slug</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>

          </ul>

        </div>

      </div>

    </SettingsPanel>
  );
}

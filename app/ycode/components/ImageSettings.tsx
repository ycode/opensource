'use client';

/**
 * Image Settings Component
 *
 * Settings panel for image layers (URL and alt text)
 */

import React, { useState, useCallback } from 'react';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import SettingsPanel from './SettingsPanel';
import InputWithInlineVariables from './InputWithInlineVariables';
import { convertContentToValue, parseValueToContent } from '@/lib/cms-variables-utils';
import type { Layer, CollectionField, Collection } from '@/types';
import { getCollectionVariable, isFieldVariable } from '@/lib/layer-utils';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { FileManagerDialog } from './FileManagerDialog';

interface ImageSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  fields?: CollectionField[];
  fieldSourceLabel?: string;
  allFields?: Record<string, CollectionField[]>;
  collections?: Collection[];
}

export default function ImageSettings({ layer, onLayerUpdate, fields, fieldSourceLabel, allFields, collections }: ImageSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [showFileManagerDialog, setShowFileManagerDialog] = useState(false);

  const handleUrlChange = useCallback((value: string) => {
    if (!layer) return;

    // Convert the value to proper format (string or FieldVariable)
    const convertedValue = convertContentToValue(value);

    onLayerUpdate(layer.id, {
      url: convertedValue,
    });
  }, [layer, onLayerUpdate]);

  const handleAltChange = useCallback((value: string) => {
    if (!layer) return;

    // Convert content format to value - extract text content only
    // Since alt is string only, we extract just the text (field variables are ignored)
    const convertedValue = convertContentToValue(value);

    // Remove any field variable markers since alt doesn't support them
    const altText = convertedValue.replace(/<ycode-inline-variable>.*?<\/ycode-inline-variable>/g, '').trim();

    onLayerUpdate(layer.id, {
      alt: altText,
    });
  }, [layer, onLayerUpdate]);

  // Only show for image layers
  if (!layer || layer.name !== 'image') {
    return null;
  }

  // Get current URL value (convert FieldVariable to content format for InputWithInlineVariables)
  const urlValue = layer.url
    ? (typeof layer.url === 'string'
      ? layer.url
      : `<ycode-inline-variable>${JSON.stringify(layer.url)}</ycode-inline-variable>`)
    : '';

  const altValue = layer.alt || '';

  // Placeholder fields for UI (just for display purposes)
  const placeholderFields: CollectionField[] = [
    {
      id: 'placeholder-1',
      name: 'Alt Text',
      key: null,
      type: 'text',
      default: null,
      fillable: true,
      order: 0,
      collection_id: 'placeholder',
      reference_collection_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      hidden: false,
      data: {},
      is_published: true,
    },
    {
      id: 'placeholder-2',
      name: 'Description',
      key: null,
      type: 'text',
      default: null,
      fillable: true,
      order: 1,
      collection_id: 'placeholder',
      reference_collection_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      hidden: false,
      data: {},
      is_published: true,
    },
    {
      id: 'placeholder-3',
      name: 'Title',
      key: null,
      type: 'text',
      default: null,
      fillable: true,
      order: 2,
      collection_id: 'placeholder',
      reference_collection_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      hidden: false,
      data: {},
      is_published: true,
    },
  ];

  // Get current alt value - alt is always a string
  const altValueFormatted = altValue || '';

  return (
    <>
    <SettingsPanel
      title="Image"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >

      <div className="flex flex-col gap-2">

        <div className="grid grid-cols-3">
          <Label variant="muted">Image</Label>
          <div className="col-span-2 flex">

          {!selectedField && (
            <div className="flex-1 flex gap-2">

              <div className="bg-input rounded-lg h-8 flex-1 overflow-hidden">
                <img src="https://app.ycode.com/images/placeholder-image.jpg?34ab150cb5cb6da2ef250e33f3a2d802" className="w-full h-full object-contain" />
              </div>
              <div className="shrink-0 flex items-center gap-2">

                <ButtonGroup className="divide-x">

                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => setShowFileManagerDialog(true)}
                  >
                    Browse
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary" size="sm"
                        aria-label="More Options"
                      >
                        <Icon name="database" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => setSelectedField('Name')}>
                          Name
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSelectedField('Slug')}>
                          Slug
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>

                  </DropdownMenu>

                </ButtonGroup>

              </div>

            </div>
          )}

            {selectedField && (
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 justify-start"
              >
                <Icon name="database" />
                <span>{selectedField}</span>
                <Button
                  className="!size-5 !p-0 -mr-1 ml-auto"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedField(null);
                  }}
                >
                  <Icon name="x" className="size-2.5" />
                </Button>
              </Button>
            )}

          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">ALT</Label>
          <div className="col-span-2 *:w-full">
            <InputWithInlineVariables
              value={altValueFormatted}
              onChange={handleAltChange}
              placeholder="Image description"
              fields={placeholderFields}
              fieldSourceLabel="Fields"
              allFields={allFields}
              collections={collections}
            />
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Size</Label>
          <div className="col-span-2 *:w-full grid grid-cols-2 gap-2">
            <InputGroup>
              <InputGroupAddon>
                <div className="flex">
                  <Tooltip>
                    <TooltipTrigger>
                      <Icon name="maxSize" className="size-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Width</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </InputGroupAddon>
              <InputGroupInput />
            </InputGroup>
            <InputGroup>
              <InputGroupAddon>
                <div className="flex">
                  <Tooltip>
                    <TooltipTrigger>
                      <Icon name="maxSize" className="size-3 rotate-90" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Height</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </InputGroupAddon>
              <InputGroupInput />
            </InputGroup>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted" htmlFor="homepage">
            Lazy load
          </Label>
          <div className="col-span-2 py-2">
            <Switch id="homepage" />
          </div>
        </div>

      </div>

    </SettingsPanel>

    {/* File Manager Dialog */}
    <FileManagerDialog
      open={showFileManagerDialog}
      onOpenChange={setShowFileManagerDialog}
    />
    </>
  );
}

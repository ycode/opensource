'use client';

/**
 * Component Variables Dialog
 *
 * Dialog for managing text variables in a component
 * Used when editing components to expose text content as variables
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import RichTextEditor from './RichTextEditor';
import ImageSettings, { type ImageSettingsValue } from './ImageSettings';
import LinkSettings, { type LinkSettingsValue } from './LinkSettings';

import { useComponentsStore } from '@/stores/useComponentsStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { createTextComponentVariableValue, extractTiptapFromComponentVariable } from '@/lib/variable-utils';

interface ComponentVariablesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  componentId: string | null;
}

export default function ComponentVariablesDialog({
  open,
  onOpenChange,
  componentId,
}: ComponentVariablesDialogProps) {
  const getComponentById = useComponentsStore((state) => state.getComponentById);
  const addTextVariable = useComponentsStore((state) => state.addTextVariable);
  const addImageVariable = useComponentsStore((state) => state.addImageVariable);
  const addLinkVariable = useComponentsStore((state) => state.addLinkVariable);
  const updateTextVariable = useComponentsStore((state) => state.updateTextVariable);
  const deleteTextVariable = useComponentsStore((state) => state.deleteTextVariable);
  const fields = useCollectionsStore((state) => state.fields);
  const collections = useCollectionsStore((state) => state.collections);

  const [selectedVariableId, setSelectedVariableId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDefaultValue, setEditingDefaultValue] = useState<any>(null);

  // Get component and its variables
  const component = componentId ? getComponentById(componentId) : undefined;
  const textVariables = component?.variables || [];

  // Get the currently selected variable
  const selectedVariable = textVariables.find((v) => v.id === selectedVariableId);

  // Helper to get empty Tiptap doc
  const getEmptyTiptapDoc = () => ({ type: 'doc', content: [{ type: 'paragraph' }] });

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      // Select first variable if exists, otherwise clear selection
      if (textVariables.length > 0) {
        setSelectedVariableId(textVariables[0].id);
        setEditingName(textVariables[0].name);
        setEditingDefaultValue(extractTiptapFromComponentVariable(textVariables[0].default_value));
      } else {
        setSelectedVariableId(null);
        setEditingName('');
        setEditingDefaultValue(getEmptyTiptapDoc());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, componentId]);

  // Update editing values when selection changes
  useEffect(() => {
    if (selectedVariable) {
      setEditingName(selectedVariable.name);
      setEditingDefaultValue(extractTiptapFromComponentVariable(selectedVariable.default_value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariableId]);

  // Handle creating a new text variable
  const handleAddTextVariable = async () => {
    if (!componentId) return;

    const newId = await addTextVariable(componentId, 'Text');
    if (newId) {
      setSelectedVariableId(newId);
      setEditingName('Text');
    }
  };

  // Handle creating a new image variable
  const handleAddImageVariable = async () => {
    if (!componentId) return;

    const newId = await addImageVariable(componentId, 'Image');
    if (newId) {
      setSelectedVariableId(newId);
      setEditingName('Image');
    }
  };

  // Handle creating a new link variable
  const handleAddLinkVariable = async () => {
    if (!componentId) return;

    const newId = await addLinkVariable(componentId, 'Link');
    if (newId) {
      setSelectedVariableId(newId);
      setEditingName('Link');
    }
  };

  // Handle image default value change (via ImageSettings standalone mode)
  const handleImageDefaultValueChange = (value: ImageSettingsValue) => {
    if (!componentId || !selectedVariableId) return;
    updateTextVariable(componentId, selectedVariableId, { default_value: value });
  };

  // Handle link default value change (via LinkSettings standalone mode)
  const handleLinkDefaultValueChange = (value: LinkSettingsValue) => {
    if (!componentId || !selectedVariableId) return;
    updateTextVariable(componentId, selectedVariableId, { default_value: value });
  };

  // Handle updating variable name (debounced)
  const handleNameChange = (value: string) => {
    setEditingName(value);
  };

  // Save name on blur
  const handleNameBlur = async () => {
    if (!componentId || !selectedVariableId || !editingName.trim()) return;
    if (selectedVariable && selectedVariable.name !== editingName.trim()) {
      await updateTextVariable(componentId, selectedVariableId, { name: editingName.trim() });
    }
  };

  // Handle updating default value (local state only)
  const handleDefaultValueChange = (tiptapContent: any) => {
    setEditingDefaultValue(tiptapContent);
  };

  // Save default value on blur
  const handleDefaultValueBlur = async (tiptapContent: any) => {
    if (!componentId || !selectedVariableId) return;

    // Check if value has changed
    const currentValue = selectedVariable?.default_value;
    const currentTiptap = extractTiptapFromComponentVariable(currentValue);

    // Simple comparison - stringify and compare
    if (JSON.stringify(currentTiptap) === JSON.stringify(tiptapContent)) {
      return; // No change, skip API call
    }

    // Wrap Tiptap content in proper ComponentVariableValue structure (text variable)
    const variableValue = createTextComponentVariableValue(tiptapContent);
    await updateTextVariable(componentId, selectedVariableId, { default_value: variableValue });
  };

  // Handle deleting a variable
  const handleDeleteVariable = async (variableId: string) => {
    if (!componentId) return;
    await deleteTextVariable(componentId, variableId);

    // Select another variable or clear selection
    const remaining = textVariables.filter((v) => v.id !== variableId);
    if (remaining.length > 0) {
      setSelectedVariableId(remaining[0].id);
      setEditingName(remaining[0].name);
    } else {
      setSelectedVariableId(null);
      setEditingName('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Component Variables</DialogTitle>
        <div className="flex -mx-6 -mt-6">
          {/* Left sidebar - variable list */}
          <div className="w-52 border-r border-border max-h-full noscrollbar overflow-y-auto h-120 px-5 flex flex-col">
            <header className="py-5 flex justify-between shrink-0">
              <span className="font-medium">Component variables</span>
              <div className="-my-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="xs" variant="secondary">
                      <Icon name="plus" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleAddTextVariable}>
                      <Icon name="text" className="size-3" />
                      Text
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleAddImageVariable}>
                      <Icon name="image" className="size-3" />
                      Image
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleAddLinkVariable}>
                      <Icon name="link" className="size-3" />
                      Link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            {/* Variable list */}
            <div className="flex flex-col gap-0.5">
              {textVariables.map((variable) => (
                <Button
                  key={variable.id}
                  variant={selectedVariableId === variable.id ? 'secondary' : 'ghost'}
                  className="justify-start"
                  onClick={() => setSelectedVariableId(variable.id)}
                >
                  <Icon name={variable.type === 'image' ? 'image' : variable.type === 'link' ? 'link' : 'text'} className="size-3" />
                  {variable.name}
                </Button>
              ))}

              {textVariables.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">
                  No variables yet. Click + to add one.
                </p>
              )}
            </div>
          </div>

          {/* Right panel - variable editor */}
          <div className="flex-1 p-6 pt-14 flex flex-col gap-2">
            {selectedVariable ? (
              <>
                <div className="grid grid-cols-3">
                  <Label variant="muted">Name</Label>
                  <div className="col-span-2 *:w-full">
                    <Input
                      type="text"
                      placeholder="Variable name"
                      value={editingName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onBlur={handleNameBlur}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3">
                  <Label variant="muted">Default</Label>
                  <div className="col-span-2 *:w-full">
                    {selectedVariable.type === 'link' ? (
                      // Link variable - use LinkSettings in standalone mode
                      <LinkSettings
                        mode="standalone"
                        value={selectedVariable.default_value as LinkSettingsValue}
                        onChange={handleLinkDefaultValueChange}
                        allFields={fields}
                        collections={collections}
                      />
                    ) : selectedVariable.type === 'image' ? (
                      // Image variable - use ImageSettings in standalone mode
                      <ImageSettings
                        mode="standalone"
                        value={selectedVariable.default_value as ImageSettingsValue}
                        onChange={handleImageDefaultValueChange}
                        allFields={fields}
                        collections={collections}
                      />
                    ) : (
                      // Text variable - use RichTextEditor
                      <RichTextEditor
                        value={editingDefaultValue}
                        onChange={handleDefaultValueChange}
                        onBlur={handleDefaultValueBlur}
                        placeholder="Default value..."
                        allFields={fields}
                        collections={collections}
                        withFormatting={true}
                        showFormattingToolbar={false}
                      />
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteVariable(selectedVariable.id)}
                  >
                    <Icon name="trash" />
                    Delete variable
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Select a variable or create a new one
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

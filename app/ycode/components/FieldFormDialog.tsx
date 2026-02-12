/**
 * FieldFormDialog Component
 *
 * Reusable dialog for creating and editing collection fields.
 * Consolidates the field form logic used in CMS.tsx for both modes.
 */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { FIELD_TYPES_BY_CATEGORY, ASSET_FIELD_TYPES, supportsDefaultValue, isAssetFieldType, getFileManagerCategory, getAssetFieldLabel, type FieldType } from '@/lib/collection-field-utils';
import { parseMultiReferenceValue } from '@/lib/collection-utils';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useAssetsStore } from '@/stores/useAssetsStore';
import RichTextEditor from './RichTextEditor';
import CollectionLinkFieldInput from './CollectionLinkFieldInput';
import AssetFieldCard from './AssetFieldCard';
import type { Asset, AssetCategoryFilter, CollectionField, CollectionFieldData, CollectionFieldType } from '@/types';

export interface FieldFormData {
  name: string;
  type: FieldType;
  default: string;
  reference_collection_id?: string | null;
  data?: CollectionFieldData;
}

interface FieldFormDialogProps {
  /** null = create mode, CollectionField = edit mode */
  field?: CollectionField | null;
  currentCollectionId?: string;
  onSubmit: (data: FieldFormData) => void | Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FieldFormDialog({
  field,
  currentCollectionId,
  onSubmit,
  open,
  onOpenChange,
}: FieldFormDialogProps) {
  // Snapshot the field when the dialog opens so content stays stable during close animation
  const stableFieldRef = useRef<CollectionField | null | undefined>(field);
  useEffect(() => {
    if (open) {
      stableFieldRef.current = field;
    }
  }, [open, field]);

  const stableField = open ? field : stableFieldRef.current;
  const mode = stableField ? 'edit' : 'create';

  // Form state
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [fieldDefault, setFieldDefault] = useState('');
  const [referenceCollectionId, setReferenceCollectionId] = useState<string | null>(null);
  const [fieldMultiple, setFieldMultiple] = useState(false);
  const [hasChangedType, setHasChangedType] = useState(false);

  // Stores
  const { collections } = useCollectionsStore();
  const { openFileManager } = useEditorStore();
  const getAsset = useAssetsStore((state) => state.getAsset);

  // Filter out the current collection from reference options (can't reference self)
  const availableCollections = React.useMemo(() => {
    const filtered = collections.filter(c => c.id !== currentCollectionId);

    // In edit mode, ensure the referenced collection is always in the list
    if (stableField?.reference_collection_id) {
      const refCollectionExists = filtered.some(c => c.id === stableField.reference_collection_id);
      if (!refCollectionExists) {
        const refCollection = collections.find(c => c.id === stableField.reference_collection_id);
        if (refCollection) {
          return [...filtered, refCollection];
        }
      }
    }

    return filtered;
  }, [collections, currentCollectionId, stableField?.reference_collection_id]);

  // Derived flags
  const isReferenceType = fieldType === 'reference' || fieldType === 'multi_reference';
  const isAssetType = ASSET_FIELD_TYPES.includes(fieldType);
  const hasDefault = supportsDefaultValue(fieldType);
  const isSubmitDisabled = !fieldName.trim() || (isReferenceType && !referenceCollectionId);

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;

    if (field) {
      setFieldName(field.name);
      setFieldType(field.type);
      setFieldDefault(field.default || '');
      setReferenceCollectionId(field.reference_collection_id || null);
      setFieldMultiple(field.data?.multiple || false);
    } else {
      setFieldName('');
      setFieldType('text');
      setFieldDefault('');
      setReferenceCollectionId(null);
      setFieldMultiple(false);
    }
    setHasChangedType(false);
  }, [open, field]);

  // Clear reference collection when switching away from reference types
  useEffect(() => {
    if (hasChangedType && !isReferenceType) {
      setReferenceCollectionId(null);
    }
  }, [isReferenceType, hasChangedType]);

  // Clear multiple setting when switching away from asset types
  useEffect(() => {
    if (hasChangedType && !isAssetType) {
      setFieldMultiple(false);
    }
  }, [isAssetType, hasChangedType]);

  // Clear/reset default value when switching types
  useEffect(() => {
    if (hasChangedType) {
      if (!hasDefault) {
        setFieldDefault('');
      } else if (fieldType === 'boolean') {
        setFieldDefault('false');
      } else {
        setFieldDefault('');
      }
    }
  }, [fieldType, hasChangedType, hasDefault]);

  const handleSubmit = async () => {
    if (!fieldName.trim()) return;
    if (isReferenceType && !referenceCollectionId) return;

    await onSubmit({
      name: fieldName.trim(),
      type: fieldType,
      default: fieldDefault,
      reference_collection_id: isReferenceType ? referenceCollectionId : null,
      data: isAssetType ? { multiple: fieldMultiple } : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'New field' : `Edit field "${stableField?.name}"`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-5 items-center gap-4">
            <Label htmlFor="field-name" className="text-right">
              Name
            </Label>
            <div className="col-span-4">
              <Input
                id="field-name"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="Field name"
              />
            </div>
          </div>

          <div className="grid grid-cols-5 items-center gap-4">
            <Label htmlFor="field-type" className="text-right">
              Type
            </Label>
            <div className="col-span-4">
              <Select
                value={fieldType}
                onValueChange={(value: any) => {
                  setFieldType(value);
                  setHasChangedType(true);
                }}
                disabled={mode === 'edit'}
              >
                <SelectTrigger id="field-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES_BY_CATEGORY.map((category, catIdx) => (
                    <React.Fragment key={category.id}>
                      {catIdx > 0 && <SelectSeparator />}
                      <SelectGroup>
                        {category.types.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <span className="flex items-center gap-2">
                              <Icon name={type.icon} className="size-3 shrink-0 opacity-60" />
                              {type.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reference Collection Selector */}
          {isReferenceType && (
            <div className="grid grid-cols-5 items-center gap-4">
              <Label htmlFor="field-reference-collection" className="text-right">
                Collection
              </Label>
              <div className="col-span-4">
                <Select
                  value={referenceCollectionId || ''}
                  onValueChange={(value) => setReferenceCollectionId(value || null)}
                  disabled={mode === 'edit'}
                >
                  <SelectTrigger id="field-reference-collection" className="w-full">
                    <SelectValue placeholder="Select a collection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {availableCollections.length > 0 ? (
                        availableCollections.map((collection) => (
                          <SelectItem key={collection.id} value={collection.id}>
                            {collection.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No collections available
                        </div>
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Multiple files toggle */}
          {isAssetType && (
            <div className="grid grid-cols-5 items-center gap-4">
              <Label htmlFor="field-multiple" className="text-right">
                Multiple
              </Label>
              <div className="col-span-4 flex items-center gap-2">
                <Switch
                  id="field-multiple"
                  checked={fieldMultiple}
                  onCheckedChange={setFieldMultiple}
                  disabled={mode === 'edit' && stableField?.data?.multiple === true}
                />
                <Label
                  htmlFor="field-multiple"
                  className="text-xs text-muted-foreground font-normal cursor-pointer"
                >
                  Allows multiple files
                </Label>
              </div>
            </div>
          )}

          {/* Default value */}
          {hasDefault && (
            <div className="grid grid-cols-5 items-start gap-4">
              <Label htmlFor="field-default" className="text-right mt-2">
                Default
              </Label>
              <div className="col-span-4">
                {isAssetFieldType(fieldType) ? (
                  fieldMultiple ? (
                    <AssetDefaultMultiple
                      fieldType={fieldType}
                      value={fieldDefault}
                      onChange={setFieldDefault}
                      openFileManager={openFileManager}
                      getAsset={getAsset}
                    />
                  ) : (
                    <AssetDefaultSingle
                      fieldType={fieldType}
                      value={fieldDefault}
                      onChange={setFieldDefault}
                      openFileManager={openFileManager}
                      getAsset={getAsset}
                    />
                  )
                ) : fieldType === 'rich_text' ? (
                  <RichTextEditor
                    value={fieldDefault}
                    onChange={setFieldDefault}
                    placeholder="Default value"
                  />
                ) : fieldType === 'link' ? (
                  <CollectionLinkFieldInput
                    value={fieldDefault}
                    onChange={setFieldDefault}
                  />
                ) : fieldType === 'boolean' ? (
                  <div className="flex items-center gap-2 h-8">
                    <Switch
                      id="field-default"
                      checked={fieldDefault === 'true'}
                      onCheckedChange={(checked) => setFieldDefault(checked ? 'true' : 'false')}
                    />
                    <Label
                      htmlFor="field-default"
                      className="text-xs text-muted-foreground font-normal cursor-pointer gap-1"
                    >
                      Value is set to <span className="text-foreground">{fieldDefault === 'true' ? 'YES' : 'NO'}</span>
                    </Label>
                  </div>
                ) : fieldType === 'number' ? (
                  <Input
                    id="field-default"
                    type="number"
                    value={fieldDefault}
                    onChange={(e) => setFieldDefault(e.target.value)}
                    placeholder="0"
                  />
                ) : fieldType === 'date' ? (
                  <Input
                    id="field-default"
                    type="datetime-local"
                    value={fieldDefault}
                    onChange={(e) => setFieldDefault(e.target.value)}
                  />
                ) : fieldType === 'email' ? (
                  <Input
                    id="field-default"
                    type="email"
                    value={fieldDefault}
                    onChange={(e) => setFieldDefault(e.target.value)}
                    placeholder="email@example.com"
                  />
                ) : fieldType === 'phone' ? (
                  <Input
                    id="field-default"
                    type="tel"
                    value={fieldDefault}
                    onChange={(e) => setFieldDefault(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                  />
                ) : (
                  <Input
                    id="field-default"
                    value={fieldDefault}
                    onChange={(e) => setFieldDefault(e.target.value)}
                    placeholder="Default value"
                  />
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
            >
              {mode === 'create' ? 'Create field' : 'Update field'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Asset Default Sub-Components
// =============================================================================

interface AssetDefaultProps {
  fieldType: CollectionFieldType;
  value: string;
  onChange: (value: string) => void;
  openFileManager: (onSelect?: ((asset: Asset) => void | false) | null, assetId?: string | null, category?: AssetCategoryFilter) => void;
  getAsset: (id: string) => Asset | null;
}

/** Single-asset default value picker */
function AssetDefaultSingle({ fieldType, value, onChange, openFileManager, getAsset }: AssetDefaultProps) {
  const asset = value ? getAsset(value) : null;
  const label = getAssetFieldLabel(fieldType);

  const handleSelect = () => {
    openFileManager(
      (selectedAsset) => { onChange(selectedAsset.id); },
      value || null,
      getFileManagerCategory(fieldType),
    );
  };

  if (!asset) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-fit"
        onClick={(e) => { e.stopPropagation(); handleSelect(); }}
      >
        <Icon name="plus" className="size-3" />
        Add {label}
      </Button>
    );
  }

  return (
    <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))]">
      <AssetFieldCard
        asset={asset}
        fieldType={fieldType}
        onChangeFile={handleSelect}
        onRemove={() => onChange('')}
      />
    </div>
  );
}

/** Multiple-asset default value picker */
function AssetDefaultMultiple({ fieldType, value, onChange, openFileManager, getAsset }: AssetDefaultProps) {
  const assetIds = parseMultiReferenceValue(value);
  const label = getAssetFieldLabel(fieldType);

  const handleAdd = () => {
    openFileManager(
      (selectedAsset) => {
        if (!assetIds.includes(selectedAsset.id)) {
          onChange(JSON.stringify([...assetIds, selectedAsset.id]));
        }
      },
      null,
      getFileManagerCategory(fieldType),
    );
  };

  const handleReplace = (oldAssetId: string) => {
    openFileManager(
      (selectedAsset) => {
        onChange(JSON.stringify(assetIds.map(id => id === oldAssetId ? selectedAsset.id : id)));
      },
      oldAssetId,
      getFileManagerCategory(fieldType),
    );
  };

  const handleRemove = (assetId: string) => {
    const updated = assetIds.filter(id => id !== assetId);
    onChange(updated.length > 0 ? JSON.stringify(updated) : '');
  };

  return (
    <div className="space-y-2">
      {assetIds.length > 0 && (
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))]">
          {assetIds.map((assetId) => (
            <AssetFieldCard
              key={assetId}
              asset={getAsset(assetId)}
              fieldType={fieldType}
              onChangeFile={() => handleReplace(assetId)}
              onRemove={() => handleRemove(assetId)}
            />
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-fit"
        onClick={(e) => { e.stopPropagation(); handleAdd(); }}
      >
        <Icon name="plus" className="size-3" />
        Add {label}
      </Button>
    </div>
  );
}

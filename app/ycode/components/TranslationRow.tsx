'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import InputWithInlineVariables from '@/app/ycode/components/InputWithInlineVariables';
import { sanitizeSlug, checkDuplicatePageSlug, checkDuplicateFolderSlug, type ValidationResult } from '@/lib/page-utils';
import type { TranslatableItem } from '@/lib/localisation-utils';
import type { Translation, CollectionField, Collection, CreateTranslationData, Page, PageFolder } from '@/types';

interface TranslationRowProps {
  item: TranslatableItem;
  selectedLocaleId: string | null;
  localInputValues: Record<string, string>;
  onLocalValueChange: (key: string, value: string) => void;
  onLocalValueClear: (key: string) => void;
  getTranslationByKey: (localeId: string, key: string) => Translation | undefined;
  createTranslation: (data: CreateTranslationData) => Promise<Translation | null>;
  updateTranslation: (translation: Translation, data: { content_value: string }) => Promise<void>;
  deleteTranslation: (translation: Translation) => Promise<void>;
  // Optional: For pages with CMS fields and inline variables support
  pageFields?: CollectionField[];
  fieldSourceLabel?: string;
  allFields?: Record<string, CollectionField[]>;
  collections?: Collection[];
  // For slug validation
  pages?: Page[];
  folders?: PageFolder[];
  sourceItem?: Page | PageFolder;
}

/**
 * Reusable component for rendering a translation row
 * Uses InputWithInlineVariables for consistent styling across all content types
 */
export default function TranslationRow({
  item,
  selectedLocaleId,
  localInputValues,
  onLocalValueChange,
  onLocalValueClear,
  getTranslationByKey,
  createTranslation,
  updateTranslation,
  deleteTranslation,
  pageFields,
  fieldSourceLabel,
  allFields,
  collections,
  pages = [],
  folders = [],
  sourceItem,
}: TranslationRowProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  // Get translation from store
  const translation = selectedLocaleId
    ? getTranslationByKey(selectedLocaleId, item.key)
    : null;
  const storeValue = translation?.content_value || '';

  // Use local value if available, otherwise use store value
  const translationValue = localInputValues[item.key] !== undefined
    ? localInputValues[item.key]
    : storeValue;

  // Check if this is a slug field (supports both old 'slug' format and new 'field:key:slug' format)
  const isSlugField = item.content_key === 'slug' || item.content_key === 'field:key:slug';

  // Update local state on change (immediate UI feedback)
  const handleTranslationChange = (value: string) => {
    let processedValue = value;

    // Slugify if this is a slug field
    if (isSlugField) {
      processedValue = sanitizeSlug(value, true); // Allow trailing dash for better UX while typing
    }

    onLocalValueChange(item.key, processedValue);

    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError(null);
    }
  };

  // Save to store/API on blur (optimistic update + API call)
  const handleTranslationBlur = (value: string) => {
    if (!selectedLocaleId) return;

    let finalValue = value;

    // Slugify and validate if this is a slug field
    if (isSlugField) {
      // Finalize slug (remove trailing dashes)
      finalValue = sanitizeSlug(value, false);

      // Validate slug uniqueness
      if (finalValue && sourceItem) {
        let validationResult: ValidationResult = { isValid: true };

        if (item.source_type === 'page') {
          const page = sourceItem as Page;
          validationResult = checkDuplicatePageSlug(
            finalValue,
            pages,
            page.page_folder_id,
            page.is_published,
            page.id
          );
        } else if (item.source_type === 'folder') {
          const folder = sourceItem as PageFolder;
          validationResult = checkDuplicateFolderSlug(
            finalValue,
            folders,
            folder.page_folder_id,
            folder.id
          );
        }

        if (!validationResult.isValid) {
          setValidationError(validationResult.error || 'This slug is already in use');
          // Update local value to show the finalized slug
          onLocalValueChange(item.key, finalValue);
          return; // Don't save if validation fails
        }
      }

      // Update local value to show the finalized slug
      if (finalValue !== value) {
        onLocalValueChange(item.key, finalValue);
      }
    }

    // Clear local value (will use store value after save)
    onLocalValueClear(item.key);

    // Only save if the value actually changed
    if (finalValue === storeValue) {
      return;
    }

    const translationData: CreateTranslationData = {
      locale_id: selectedLocaleId,
      source_type: item.source_type as CreateTranslationData['source_type'],
      source_id: item.source_id,
      content_key: item.content_key,
      content_type: item.content_type as CreateTranslationData['content_type'],
      content_value: finalValue,
    };

    if (translation) {
      // Update existing translation (optimistic + API call)
      updateTranslation(translation, { content_value: finalValue });
    } else {
      // Create new translation (optimistic + API call)
      createTranslation(translationData);
    }
  };

  // Reset translation
  const handleReset = async () => {
    if (!selectedLocaleId) return;
    const translation = getTranslationByKey(selectedLocaleId, item.key);
    if (translation) {
      await deleteTranslation(translation);
    }
  };

  return (
    <li key={item.key} className="flex flex-col gap-1.5">
      {/* Item header */}
      <div className="flex items-center gap-1.75">
        <div className="size-5 flex items-center justify-center rounded-[6px] bg-secondary/50">
          <Icon name={item.info.icon} className="shrink-0 size-2.5 opacity-50" />
        </div>

        <span className="text-xs font-medium opacity-60">{item.info.label}</span>

        {item.info.description && (
          <>
            <Separator className="w-3! bg-foreground/8" />
            <div className="text-[11px] text-muted-foreground/70">{item.info.description}</div>
          </>
        )}

        <Separator className="min-w-0 flex-1 bg-foreground/8" />
      </div>

      <div className="flex items-center gap-2">
        <div className="w-full grid grid-cols-2 gap-2">
          {/* Left side (default locale value, read-only) */}
          <div className="text-sm opacity-50">
            <InputWithInlineVariables
              value={item.content_value}
              onChange={() => {}} // Read-only on left side
              placeholder=""
              fields={pageFields}
              fieldSourceLabel={fieldSourceLabel}
              allFields={allFields}
              collections={collections}
              disabled={true}
            />
          </div>

          {/* Right side (translation value, editable) */}
          <div className="flex flex-col gap-1">
            <InputWithInlineVariables
              value={translationValue}
              onChange={handleTranslationChange}
              onBlur={handleTranslationBlur}
              placeholder="Enter translation..."
              className={`min-h-[28px] [&_.ProseMirror]:py-1 [&_.ProseMirror]:px-2.5 [&_.ProseMirror]:!bg-transparent ${
                validationError ? '[&_.ProseMirror]:!border-destructive' : ''
              }`}
              fields={pageFields}
              fieldSourceLabel={fieldSourceLabel}
              allFields={allFields}
              collections={collections}
            />
            {validationError && (
              <span className="text-[11px] text-destructive">{validationError}</span>
            )}
          </div>
        </div>

        {/* Dropdown menu */}
        <div className="">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <Icon name="more" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Done</DropdownMenuItem>
              <DropdownMenuItem onClick={handleReset}>
                Reset
              </DropdownMenuItem>
              <DropdownMenuItem>Auto-translate</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}

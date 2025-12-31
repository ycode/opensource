/**
 * Block Templates System
 *
 * Provides template definitions and helper functions for creating new layers
 */

import { Layer, LayerTemplate, LayerTemplateRef } from '@/types';
import { IconProps } from '@/components/ui/icon';
import { generateId, cloneDeep } from '@/lib/utils';
import { structureTemplates } from './structure';
import { contentTemplates } from './content';
import { actionTemplates } from './actions';
import { mediaTemplates } from './media';
import { formTemplates } from './forms';
import { utilityTemplates } from './utilities';
import { layoutTemplates } from './layouts';

// Merge all template categories
const blocks = {
  ...structureTemplates,
  ...contentTemplates,
  ...actionTemplates,
  ...mediaTemplates,
  ...formTemplates,
  ...utilityTemplates,
};

/**
 * Get a layer (with IDs) from a template
 */
export function getLayerFromTemplate(
  index: string,
  overrides?: Partial<Layer>
): Layer | null {
  const block = blocks[index as keyof typeof blocks];

  if (!block) return null;

  const template = cloneDeep(block.template);

  // Resolve any template references first
  const resolvedTemplate = resolveTemplateRefs(template);

  // Recursively assign IDs to all nested children
  const assignIds = (layer: Omit<Layer, 'id'>): Layer => {
    const layerWithId = { ...layer, id: generateId('lyr') } as Layer;

    if (layerWithId.children && Array.isArray(layerWithId.children)) {
      layerWithId.children = layerWithId.children.map((child) => assignIds(child as Omit<Layer, 'id'>)) as Layer[];
    }

    return layerWithId;
  };

  const templateWithIds = assignIds(resolvedTemplate as Omit<Layer, 'id'>);

  if (overrides && Object.keys(overrides).length > 0) {
    return { ...templateWithIds, ...overrides };
  }

  return templateWithIds;
}

/**
 * Create a lazy template reference (resolved later, not during initialization)
 * @param index - Template name to reference
 * @param overrides - Optional property overrides to apply to the referenced template
 */
export function getTemplateRef(index: string, overrides?: Partial<LayerTemplate>): LayerTemplateRef {
  return overrides ? { __ref: index, ...overrides } : { __ref: index };
}

/**
 * Resolve template references in a layer structure
 * Replaces { __ref: 'name', ...overrides } objects with actual templates and applies overrides
 */
function resolveTemplateRefs(obj: any): any {
  // Check if this is a template reference
  if (obj && typeof obj === 'object' && '__ref' in obj) {
    const { __ref: refName, ...overrides } = obj;
    const block = blocks[refName as keyof typeof blocks];

    if (!block) {
      console.warn(`Template reference "${refName}" not found`);
      return { name: 'div', classes: [], children: [] };
    }

    // Clone and resolve the referenced template (recursively resolves all children)
    const resolvedTemplate = resolveTemplateRefs(cloneDeep(block.template));

    // Apply overrides if any, and resolve any __ref in overrides too
    if (Object.keys(overrides).length > 0) {
      const resolvedOverrides: any = {};
      for (const key in overrides) {
        if (overrides.hasOwnProperty(key)) {
          // Resolve any __ref in override values (especially important for children arrays)
          resolvedOverrides[key] = resolveTemplateRefs(overrides[key]);
        }
      }
      return { ...resolvedTemplate, ...resolvedOverrides };
    }

    return resolvedTemplate;
  }

  // If it's an array, resolve each item
  if (Array.isArray(obj)) {
    return obj.map(item => resolveTemplateRefs(item));
  }

  // If it's an object, resolve all properties
  if (obj && typeof obj === 'object') {
    const resolved: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        resolved[key] = resolveTemplateRefs(obj[key]);
      }
    }
    return resolved;
  }

  return obj;
}

/**
 * Get icon name for a block type
 */
export function getBlockIcon(
  key: string,
  defaultIcon: IconProps['name'] = 'box'
): IconProps['name'] {
  const block = blocks[key as keyof typeof blocks];
  return (block?.icon as IconProps['name']) || defaultIcon;
}

/**
 * Get display name for a block type
 */
export function getBlockName(index: string): string | null {
  const block = blocks[index as keyof typeof blocks];
  return block?.name || null;
}

/**
 * Get all blocks by category
 */
export function getBlocksByCategory(category: 'structure' | 'content' | 'actions' | 'media' | 'forms' | 'utilities') {
  switch (category) {
    case 'structure':
      return Object.keys(structureTemplates);
    case 'content':
      return Object.keys(contentTemplates);
    case 'actions':
      return Object.keys(actionTemplates);
    case 'media':
      return Object.keys(mediaTemplates);
    case 'forms':
      return Object.keys(formTemplates);
    case 'utilities':
      return Object.keys(utilityTemplates);
    default:
      return [];
  }
}

/**
 * Get all available block types
 */
export function getAllBlockTypes(): string[] {
  return Object.keys(blocks);
}

/**
 * Get layout template by key
 */
export function getLayoutTemplate(key: string): Layer | null {
  const layout = layoutTemplates[key as keyof typeof layoutTemplates];
  if (!layout) return null;

  const template = cloneDeep(layout.template);

  // Resolve any template references first
  const resolvedTemplate = resolveTemplateRefs(template);

  // Recursively assign IDs to all nested children
  const assignIds = (layer: LayerTemplate): Layer => {
    const layerWithId = { ...layer, id: generateId('lyr') } as Layer;

    if (layerWithId.children && Array.isArray(layerWithId.children)) {
      layerWithId.children = layerWithId.children.map((child) => assignIds(child as LayerTemplate)) as Layer[];
    }

    return layerWithId;
  };

  return assignIds(resolvedTemplate as LayerTemplate);
}

/**
 * Get layout icon
 * @deprecated Icons are no longer part of layout templates
 */
export function getLayoutIcon(key: string): IconProps['name'] {
  return 'box';
}

/**
 * Get layout name
 * @deprecated Names are no longer part of layout templates
 */
export function getLayoutName(key: string): string | null {
  return null;
}

/**
 * Get layout description
 * @deprecated Descriptions are no longer part of layout templates
 */
export function getLayoutDescription(key: string): string | undefined {
  return undefined;
}

/**
 * Get layout category
 */
export function getLayoutCategory(key: string): string | undefined {
  const layout = layoutTemplates[key as keyof typeof layoutTemplates];
  return layout?.category;
}

/**
 * Get layout preview image
 */
export function getLayoutPreviewImage(key: string): string | undefined {
  const layout = layoutTemplates[key as keyof typeof layoutTemplates];
  return layout?.previewImage;
}

/**
 * Get all layout keys
 */
export function getAllLayoutKeys(): string[] {
  return Object.keys(layoutTemplates);
}

/**
 * Get layouts grouped by category
 */
export function getLayoutsByCategory(): Record<string, string[]> {
  const categories: Record<string, string[]> = {};

  Object.keys(layoutTemplates).forEach((key) => {
    const category = layoutTemplates[key as keyof typeof layoutTemplates].category || 'Other';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(key);
  });

  return categories;
}

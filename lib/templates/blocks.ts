/**
 * Block Templates System
 * 
 * Provides template definitions and helper functions for creating new layers
 */

import { Layer } from '@/types';
import { structureTemplates } from './structure';
import { contentTemplates } from './content';
import { actionTemplates } from './actions';
import { mediaTemplates } from './media';
import { formTemplates } from './forms';

// Merge all template categories
const blocks = {
  ...structureTemplates,
  ...contentTemplates,
  ...actionTemplates,
  ...mediaTemplates,
  ...formTemplates,
};

// Generate unique ID
export function generateId(): string {
  return `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Deep clone object
function cloneDeep<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => cloneDeep(item)) as any;
  if (obj instanceof Object) {
    const clonedObj = {} as any;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = cloneDeep(obj[key]);
      }
    }
    return clonedObj;
  }
  throw new Error('Unable to clone object');
}

// Merge objects
function merge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  for (const source of sources) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const value = source[key];
        if (value !== undefined) {
          target[key as keyof T] = value as T[keyof T];
        }
      }
    }
  }
  return target;
}

/**
 * Get template for a block type
 */
export function getTemplate(
  index: string,
  overrides?: Partial<Layer>
): Layer | null {
  const block = blocks[index as keyof typeof blocks];
  if (!block) return null;
  
  const template = cloneDeep(block.template);
  
  // Recursively assign IDs to all nested children
  const assignIds = (layer: any): any => {
    layer.id = generateId();
    
    if (layer.items && Array.isArray(layer.items)) {
      layer.items = layer.items.map((child: any) => assignIds(child));
    }
    
    return layer;
  };
  
  const templateWithIds = assignIds(template);
  
  return merge(templateWithIds, overrides || {});
}

/**
 * Get icon name for a block type
 */
export function getIcon(index: string): string | null {
  const block = blocks[index as keyof typeof blocks];
  return block?.icon || null;
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
export function getBlocksByCategory(category: 'structure' | 'content' | 'actions' | 'media' | 'forms') {
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


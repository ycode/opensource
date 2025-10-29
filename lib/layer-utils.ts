/**
 * Layer utilities for rendering and manipulation
 */

import { Layer } from '@/types';

/**
 * Get the HTML tag name for a layer
 */
export function getHtmlTag(layer: Layer): string {
  // If layer has a name property (new system), use that
  if (layer.name) {
    return layer.name;
  }

  // Fall back to type-based mapping (old system)
  if (layer.type === 'container') return 'div';
  if (layer.type === 'heading') return 'h1';
  if (layer.type === 'text') return 'p';
  if (layer.type === 'image') return 'img';

  // Default
  return 'div';
}

/**
 * Get classes as string (support both string and array formats)
 */
export function getClassesString(layer: Layer): string {
  if (Array.isArray(layer.classes)) {
    return layer.classes.join(' ');
  }
  return layer.classes || '';
}

/**
 * Get children layers (support both items and children)
 */
export function getChildren(layer: Layer): Layer[] | undefined {
  return layer.items || layer.children;
}

/**
 * Get text content (support both text and content properties)
 */
export function getText(layer: Layer): string | undefined {
  return layer.text || layer.content;
}

/**
 * Get image URL (support both url and src properties)
 */
export function getImageUrl(layer: Layer): string | undefined {
  return layer.url || layer.src;
}



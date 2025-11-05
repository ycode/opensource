/**
 * Layer utilities for rendering and manipulation
 */

import { Layer } from '@/types';

/**
 * Find a layer by ID in a tree structure
 * Recursively searches through layer tree
 */
export function findLayerById(layers: Layer[], id: string): Layer | null {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    if (layer.children) {
      const found = findLayerById(layer.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Get the HTML tag name for a layer
 */
export function getHtmlTag(layer: Layer): string {
  // Priority 1: Check settings.tag override
  if (layer.settings?.tag) {
    return layer.settings.tag;
  }
  
  // Priority 2: Use name property (new system)
  if (layer.name) {
    return layer.name;
  }

  // Priority 3: Fall back to type-based mapping (old system)
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

/**
 * Elements that cannot have children (void elements + text-only elements)
 */
const ELEMENTS_WITHOUT_CHILDREN = [
  // Void/self-closing elements
  'img',
  'input', 
  'hr',
  'br',
  'icon',
  'video',
  'audio',
  'image',    // Old system
  
  // Text-only elements that should be leaf nodes
  'heading',  // Generic heading
  'h1',
  'h2', 
  'h3',
  'h4',
  'h5',
  'h6',
  'p',        // Paragraph
  'span',     // Inline text
  'label',    // Form label
  'button',   // Button (text content only in builder)
  'text',     // Old system text type
  
  // Form inputs (technically not void but shouldn't have children in builder)
  'textarea',
  'select',
  'checkbox',
  'radio',
];

/**
 * Check if a layer can have children based on its name/type
 */
export function canHaveChildren(layer: Layer): boolean {
  const elementName = (layer.name || layer.type) ?? '';
  return !ELEMENTS_WITHOUT_CHILDREN.includes(elementName);
}


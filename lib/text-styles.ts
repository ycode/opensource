/**
 * Text Styles Constants
 *
 * Single source of truth for default text styles for Tiptap formatting.
 * Used by:
 * - React LayerRenderer (via direct import)
 * - Canvas iframe renderer (via lib/iframe-constants.ts)
 * - Tiptap utilities (via direct import)
 */

import type { TextStyle } from '@/types';

/**
 * Default text styles for formatting marks (bold, italic, underline, etc.)
 * Used in text element templates and can be overridden per layer
 */
export const DEFAULT_TEXT_STYLES: Record<string, TextStyle> = {
  bold: { classes: 'font-bold' },
  italic: { classes: 'italic' },
  underline: { classes: 'underline' },
  strike: { classes: 'line-through' },
  code: { classes: 'font-mono bg-muted px-1 py-0.5 rounded text-sm' },
  bulletList: { classes: 'my-2 pl-6 list-disc' },
  orderedList: { classes: 'my-2 pl-6 list-decimal' },
  listItem: { classes: 'my-1 pl-1' },
};

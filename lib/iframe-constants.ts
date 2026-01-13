/**
 * Iframe Constants
 *
 * Central place for all constants that need to be shared with the canvas iframe.
 * This makes it easy to add new constants without modifying multiple files.
 */

import { DEFAULT_TEXT_STYLES } from '@/lib/text-styles';
import { DEFAULT_ASSETS } from '@/lib/asset-utils';
import { getIconAsString } from '@/components/ui/icon';
import type { TextStyle } from '@/types';

/**
 * Toolbar icons for the rich text editor (SVG strings)
 * Auto-generated from the Icon component to maintain single source of truth
 */
const TOOLBAR_ICONS = {
  bold: getIconAsString('bold'),
  italic: getIconAsString('italic'),
  underline: getIconAsString('underline'),
  strike: getIconAsString('strikethrough'),
  bulletList: getIconAsString('listUnordered'),
  orderedList: getIconAsString('listOrdered'),
  variable: getIconAsString('database'),
};

/**
 * All constants that are sent to the canvas iframe
 */
export interface IframeConstants {
  /** Default text styles for Tiptap formatting */
  textStyles: Record<string, TextStyle>;

  /** Default placeholder assets */
  defaultAssets: {
    IMAGE: string;
    ICON: string;
    VIDEO: string;
    AUDIO: string;
  };

  /** Toolbar icons for rich text editor */
  toolbarIcons: Record<string, string>;
}

/**
 * Get all constants that should be sent to the iframe
 */
export function getIframeConstants(): IframeConstants {
  return {
    textStyles: DEFAULT_TEXT_STYLES,
    defaultAssets: DEFAULT_ASSETS,
    toolbarIcons: TOOLBAR_ICONS,
  };
}

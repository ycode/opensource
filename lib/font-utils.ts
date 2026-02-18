/**
 * Font Utilities
 *
 * Shared utilities for building font CSS (Google Fonts @import, custom @font-face),
 * generating Tailwind-compatible class names, and font URL construction.
 */

import type { Font } from '@/types';

/** Built-in system fonts available without loading */
export const BUILT_IN_FONTS: Font[] = [
  {
    id: 'system-sans',
    name: 'sans',
    family: 'Sans Serif',
    type: 'default',
    variants: ['100', '200', '300', 'regular', '500', '600', '700', '800', '900'],
    weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    category: 'sans-serif',
    is_published: false,
    created_at: '',
    updated_at: '',
    deleted_at: null,
  },
  {
    id: 'system-serif',
    name: 'serif',
    family: 'Serif',
    type: 'default',
    variants: ['regular', '700'],
    weights: ['400', '700'],
    category: 'serif',
    is_published: false,
    created_at: '',
    updated_at: '',
    deleted_at: null,
  },
  {
    id: 'system-mono',
    name: 'mono',
    family: 'Monospace',
    type: 'default',
    variants: ['regular', '700'],
    weights: ['400', '700'],
    category: 'monospace',
    is_published: false,
    created_at: '',
    updated_at: '',
    deleted_at: null,
  },
];

/** All available font weight values */
export const FONT_WEIGHTS = [
  { value: '100', label: 'Thin' },
  { value: '200', label: 'Extra Light' },
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi Bold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra Bold' },
  { value: '900', label: 'Black' },
];

/** Allowed font file extensions */
export const ALLOWED_FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'];
export const ALLOWED_FONT_MIME_TYPES = [
  'font/ttf',
  'font/otf',
  'font/woff',
  'font/woff2',
  'application/x-font-ttf',
  'application/x-font-otf',
  'application/font-woff',
  'application/font-woff2',
  'application/octet-stream', // Common fallback for font files
];

/**
 * Convert a font family name to a Tailwind-compatible class name.
 * e.g., "Open Sans" → "font-[Open_Sans]"
 */
export function getFontClassName(family: string): string {
  // Built-in font families use standard Tailwind classes
  if (family === 'Sans Serif' || family === 'sans') return 'font-sans';
  if (family === 'Serif' || family === 'serif') return 'font-serif';
  if (family === 'Monospace' || family === 'mono') return 'font-mono';

  // Custom/Google fonts use arbitrary value syntax with underscores
  const sanitized = family.replace(/\s+/g, '_');
  return `font-[${sanitized}]`;
}

/**
 * Convert a font family name to the value stored in layer.design.typography.fontFamily
 */
export function getFontFamilyValue(font: Font): string {
  if (font.type === 'default') {
    return font.name; // 'sans', 'serif', 'mono'
  }
  return font.family;
}

/**
 * Build a Google Fonts CSS2 API URL for a font
 */
export function buildGoogleFontUrl(font: Font): string {
  const baseUrl = 'https://fonts.googleapis.com/css2?family=';
  const parts: string[] = [baseUrl];

  // Font name with + for spaces
  parts.push(font.family.replace(/\s/g, '+'));

  const variants = font.variants || [];

  if (variants.length > 0) {
    parts.push(':');

    const variantUrlParts = getFontVariantsUrlElements(variants);
    parts.push(variantUrlParts.fontVariantsUrlPart);

    const weights = font.weights || extractWeightsFromVariants(variants);
    if (weights.length > 0) {
      const weightUrlElements: string[] = [];
      const hasItalic = variants.includes('italic');

      for (const weight of weights) {
        if (hasItalic) {
          const repetition = weightUrlElements.filter(e => e.includes(weight)).length;
          weightUrlElements.push(`${repetition},${weight};`);
        } else {
          weightUrlElements.push(`${weight};`);
        }
      }

      weightUrlElements.sort();
      parts.push('wght@');
      // Remove trailing semicolon
      parts.push(weightUrlElements.join('').slice(0, -1));
    }
  }

  parts.push('&display=swap');

  return parts.join('');
}

/**
 * Parse font variants into URL elements for Google Fonts API
 */
function getFontVariantsUrlElements(variants: string[]): {
  fontVariantsUrlPart: string;
  fontWeights: string[];
} {
  const fontVariantsUrlElements: string[] = [];
  const fontWeights: string[] = [];

  const filteredVariants = variants.map(variant => {
    if (variant === 'italic' || variant === 'regular' || !isNaN(Number(variant))) return variant;
    return variant.replace('italic', '');
  });

  filteredVariants.forEach((variant, index) => {
    const weight = getWeightFromVariantName(variant);

    if (!weight) {
      fontVariantsUrlElements.push(variant);
    } else {
      fontWeights.push(weight);
    }

    if (index !== variants.length - 1 && !weight) {
      fontVariantsUrlElements.push(',');
    }
  });

  const fontVariantsUrlPart = fontVariantsUrlElements
    .map(e => e.replace('regular,', '').replace('italic', 'ital,'))
    .join('');

  return {
    fontVariantsUrlPart,
    fontWeights: fontWeights.length > 0 ? fontWeights : ['400', '700'],
  };
}

/**
 * Extract numeric weight from a variant name (e.g., "700italic" → "700")
 */
function getWeightFromVariantName(variant: string): string | null {
  if (variant === 'regular') variant = '400';

  const validWeights = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
  return validWeights.find(w => variant.includes(w)) || null;
}

/**
 * Extract numeric weights from font variant names
 */
function extractWeightsFromVariants(variants: string[]): string[] {
  return variants
    .map(v => {
      if (v === 'italic' || v === 'regular') return '400';
      if (!isNaN(Number(v))) return v;
      return null;
    })
    .filter((v): v is string => v !== null);
}

/**
 * Get available Tailwind weights for a font
 */
export function getFontAvailableWeights(font: Font): string[] {
  if (font.weights && font.weights.length > 0) {
    return font.weights;
  }

  return extractWeightsFromVariants(font.variants || []);
}

/**
 * Map file extension to CSS @font-face format string
 */
export function mapExtensionToFontFormat(extension: string): string | null {
  switch (extension.toLowerCase()) {
    case 'eot': return 'embedded-opentype';
    case 'otf': return 'opentype';
    case 'ttf': return 'truetype';
    case 'woff': return 'woff';
    case 'woff2': return 'woff2';
    default: return null;
  }
}

/**
 * Build CSS for loading all installed fonts.
 * Generates @import rules for Google fonts and @font-face for custom fonts.
 */
export function buildFontsCss(fonts: Font[]): string {
  let css = '';

  for (const font of fonts) {
    if (font.type === 'google') {
      const url = buildGoogleFontUrl(font);
      css += `@import url('${url}');`;
    }

    if (font.type === 'custom' && font.url) {
      const family = font.family.replace(/"/g, '\\"');
      const format = font.kind || 'woff2';
      css += `@font-face {font-family: "${family}";src: url("${font.url}") format("${format}");font-display: swap;}`;
    }
  }

  return css;
}

/** Get Google Font stylesheet URLs for <link> elements (more reliable than @import) */
export function getGoogleFontLinks(fonts: Font[]): string[] {
  return fonts
    .filter(f => f.type === 'google')
    .map(f => buildGoogleFontUrl(f));
}

/** Build CSS for custom fonts only (@font-face rules, no @import) */
export function buildCustomFontsCss(fonts: Font[]): string {
  let css = '';

  for (const font of fonts) {
    if (font.type === 'custom' && font.url) {
      const family = font.family.replace(/"/g, '\\"');
      const format = font.kind || 'woff2';
      css += `@font-face {font-family: "${family}";src: url("${font.url}") format("${format}");font-display: swap;}`;
    }
  }

  return css;
}

/**
 * Build CSS class rules for font-family declarations.
 * Creates Tailwind-compatible CSS rules that map class names to font-family values.
 */
export function buildFontClassesCss(fonts: Font[]): string {
  let css = '';

  for (const font of fonts) {
    if (font.type === 'default') continue; // Built-in fonts handled by Tailwind defaults

    const { family, category } = font;
    const className = getFontClassName(family);

    let fontFamilyValue = `"${family}"`;
    if (category) {
      fontFamilyValue += `, ${category}`;
    }

    // Base class
    css += `.${escapeClassName(className)} { font-family: ${fontFamilyValue}; } `;

    // Pseudo-state variants
    const states = ['hover', 'focus', 'active', 'disabled', 'current'];
    for (const state of states) {
      css += `.${state}\\:${escapeClassName(className)}:${state} { font-family: ${fontFamilyValue}; } `;
    }
  }

  return css;
}

/**
 * Build complete font CSS (imports + class rules)
 */
export function buildAllFontsCss(fonts: Font[]): string {
  return buildFontsCss(fonts) + buildFontClassesCss(fonts);
}

/**
 * Escape CSS class name for use in selectors
 */
function escapeClassName(className: string): string {
  return className
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

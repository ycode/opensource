/**
 * Fonts Store
 *
 * Global store for managing installed fonts (Google + custom).
 * Handles font loading, CSS injection, and font selection.
 */

import { create } from 'zustand';
import { buildAllFontsCss, buildGoogleFontUrl, BUILT_IN_FONTS, getFontFamilyValue } from '@/lib/font-utils';
import type { Font } from '@/types';

interface GoogleFontResult {
  family: string;
  variants: string[];
  category: string;
}

interface FontsState {
  fonts: Font[];
  fontsCss: string;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  googleFontsCatalog: GoogleFontResult[];
  googleSearchResults: GoogleFontResult[];
  isCatalogLoaded: boolean;
}

interface FontsActions {
  loadFonts: () => Promise<void>;
  setFonts: (fonts: Font[]) => void;
  addFont: (font: Font) => void;
  removeFont: (fontId: string) => void;
  uploadCustomFonts: (files: File[]) => Promise<Font[]>;
  addGoogleFont: (googleFont: GoogleFontResult) => Promise<Font | null>;
  deleteFont: (fontId: string) => Promise<void>;
  loadGoogleFontsCatalog: () => Promise<void>;
  searchGoogleFonts: (query: string) => void;
  rebuildCss: () => void;
  injectFontsCss: (iframeDocument?: Document | null) => void;
  getFontByFamily: (family: string) => Font | undefined;
  reset: () => void;
}

type FontsStore = FontsState & FontsActions;

const initialState: FontsState = {
  fonts: [],
  fontsCss: '',
  isLoading: false,
  isLoaded: false,
  error: null,
  googleFontsCatalog: [],
  googleSearchResults: [],
  isCatalogLoaded: false,
};

export const useFontsStore = create<FontsStore>((set, get) => ({
  ...initialState,

  /** Load fonts from API */
  loadFonts: async () => {
    if (get().isLoaded || get().isLoading) return;

    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/ycode/api/fonts');
      if (!response.ok) throw new Error('Failed to fetch fonts');

      const { data: fonts } = await response.json();

      set({
        fonts: fonts || [],
        isLoading: false,
        isLoaded: true,
      });

      // Build and inject CSS
      get().rebuildCss();
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load fonts',
      });
    }
  },

  /** Set fonts directly (e.g., from initial load) */
  setFonts: (fonts: Font[]) => {
    set({ fonts, isLoaded: true });
    get().rebuildCss();
  },

  /** Add a font to the store */
  addFont: (font: Font) => {
    set((state) => ({
      fonts: [...state.fonts, font],
    }));
    get().rebuildCss();
  },

  /** Remove a font from the store */
  removeFont: (fontId: string) => {
    set((state) => ({
      fonts: state.fonts.filter(f => f.id !== fontId),
    }));
    get().rebuildCss();
  },

  /** Upload custom font files */
  uploadCustomFonts: async (files: File[]): Promise<Font[]> => {
    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append('file', file);
      }

      const response = await fetch('/ycode/api/fonts', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload fonts');
      }

      const { data: fonts } = await response.json();

      if (fonts && fonts.length > 0) {
        set((state) => ({
          fonts: [...state.fonts, ...fonts],
        }));
        get().rebuildCss();
      }

      return fonts || [];
    } catch (error) {
      console.error('Failed to upload fonts:', error);
      throw error;
    }
  },

  /** Add a Google Font from search results */
  addGoogleFont: async (googleFont: GoogleFontResult): Promise<Font | null> => {
    try {
      const slug = googleFont.family.toLowerCase().replace(/\s+/g, '-');

      // Check if font already exists
      const existing = get().fonts.find(f => f.name === slug);
      if (existing) return existing;

      // Extract weights from variants
      const weights = googleFont.variants
        .map(v => {
          if (v === 'regular') return '400';
          if (v === 'italic') return null;
          if (!isNaN(Number(v))) return v;
          const numMatch = v.match(/^\d+/);
          return numMatch ? numMatch[0] : null;
        })
        .filter((w): w is string => w !== null)
        .filter((w, i, arr) => arr.indexOf(w) === i);

      const response = await fetch('/ycode/api/fonts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: slug,
          family: googleFont.family,
          type: 'google',
          variants: googleFont.variants,
          weights: weights.length > 0 ? weights : ['400', '700'],
          category: googleFont.category,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add Google Font');
      }

      const { data: font } = await response.json();

      if (font) {
        set((state) => ({
          fonts: [...state.fonts, font],
        }));
        get().rebuildCss();
      }

      return font;
    } catch (error) {
      console.error('Failed to add Google Font:', error);
      throw error;
    }
  },

  /** Delete a font */
  deleteFont: async (fontId: string) => {
    try {
      const response = await fetch(`/ycode/api/fonts/${fontId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete font');
      }

      get().removeFont(fontId);
    } catch (error) {
      console.error('Failed to delete font:', error);
      throw error;
    }
  },

  /** Load the static Google Fonts catalog (fetched once, cached in state) */
  loadGoogleFontsCatalog: async () => {
    if (get().isCatalogLoaded) return;

    try {
      const response = await fetch('/ycode/api/fonts/google');
      if (!response.ok) throw new Error('Failed to load Google Fonts catalog');

      const { data } = await response.json();
      set({ googleFontsCatalog: data || [], isCatalogLoaded: true });
    } catch (error) {
      console.error('Failed to load Google Fonts catalog:', error);
    }
  },

  /** Filter the cached catalog client-side (no limit — component handles pagination) */
  searchGoogleFonts: (query: string) => {
    const { googleFontsCatalog } = get();

    if (!query) {
      set({ googleSearchResults: googleFontsCatalog });
      return;
    }

    const lower = query.toLowerCase();
    const filtered = googleFontsCatalog
      .filter(f => f.family.toLowerCase().includes(lower));

    set({ googleSearchResults: filtered });
  },

  /** Rebuild font CSS from current font list */
  rebuildCss: () => {
    const { fonts } = get();
    const css = buildAllFontsCss(fonts);
    set({ fontsCss: css });

    // Auto-inject if already in browser
    if (typeof window !== 'undefined') {
      get().injectFontsCss();
    }
  },

  /**
   * Inject font CSS into the document and optionally into an iframe.
   * Uses <link> elements for Google Fonts (reliable cross-origin loading)
   * and <style> elements for @font-face and class rules.
   */
  injectFontsCss: (iframeDocument?: Document | null) => {
    const { fonts, fontsCss } = get();
    const styleId = 'ycode-fonts-style';

    // Inject into main document (builder)
    injectStyleIntoDocument(document, styleId, fontsCss);

    // Inject into canvas iframe if provided
    if (iframeDocument) {
      injectStyleIntoDocument(iframeDocument, styleId, fontsCss);
      injectGoogleFontLinks(iframeDocument, fonts);
    }
  },

  /** Get a font by its family value (as stored in layer.design.typography.fontFamily) */
  getFontByFamily: (family: string): Font | undefined => {
    const { fonts } = get();

    // Check built-in fonts first
    const builtIn = BUILT_IN_FONTS.find(f =>
      f.name === family || f.family === family
    );
    if (builtIn) return builtIn;

    // Check installed fonts
    return fonts.find(f =>
      getFontFamilyValue(f) === family || f.family === family || f.name === family
    );
  },

  /** Reset store */
  reset: () => set(initialState),
}));

/** Helper to inject/update a style element in a document */
function injectStyleIntoDocument(doc: Document, styleId: string, css: string) {
  let styleEl = doc.getElementById(styleId) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = styleId;
    doc.head.appendChild(styleEl);
  }

  styleEl.textContent = css;
}

/**
 * Inject Google Fonts as <link> elements into a document (e.g. iframe).
 * <link> elements load more reliably than @import inside <style> tags,
 * especially in cross-origin iframe contexts.
 */
function injectGoogleFontLinks(doc: Document, fonts: Font[]) {
  const prefix = 'ycode-gfont-';
  const googleFonts = fonts.filter(f => f.type === 'google');

  // Track which links already exist
  const existingIds = new Set<string>();
  doc.querySelectorAll(`link[id^="${prefix}"]`).forEach(el => existingIds.add(el.id));

  for (const font of googleFonts) {
    const linkId = `${prefix}${font.id}`;
    if (existingIds.has(linkId)) {
      existingIds.delete(linkId);
      continue;
    }

    const link = doc.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = buildGoogleFontUrl(font);
    doc.head.appendChild(link);
  }

  // Remove links for fonts that were deleted
  for (const staleId of existingIds) {
    doc.getElementById(staleId)?.remove();
  }
}

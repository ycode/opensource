/**
 * Google Font Preview
 *
 * Lazily loads Google Font CSS for rendering font name previews.
 * Splits families into separate <link> elements to avoid long URLs
 * that trigger Chrome's ORB (Opaque Resource Blocking).
 * Uses document.fonts.load() to force-download font files before rendering.
 */

const STYLE_PREFIX = 'gfp-batch-';
const FONTS_CSS_BASE = 'https://fonts.googleapis.com/css2';
const BATCH_SIZE = 50;

/** Families already queued for loading */
const loadedFamilies = new Set<string>();

/** Current batch index */
let batchIndex = 0;

/** Pending families waiting to be flushed as a <link> */
let pendingFamilies: string[] = [];

/** Flush pending families into a new <link> element and preload font files */
function flushPending() {
  if (pendingFamilies.length === 0) return;

  const families = [...pendingFamilies];
  pendingFamilies = [];

  const params = new URLSearchParams({ display: 'swap' });
  for (const family of families) {
    params.append('family', `${family}:wght@400`);
  }

  const link = document.createElement('link');
  link.id = `${STYLE_PREFIX}${batchIndex++}`;
  link.rel = 'stylesheet';
  link.href = `${FONTS_CSS_BASE}?${params.toString()}`;

  // Once CSS is loaded, force-download the actual font files
  link.onload = () => {
    for (const family of families) {
      document.fonts.load(`16px '${family}'`).catch(() => {});
    }
  };

  document.head.appendChild(link);
}

/**
 * Ensure Google Font CSS is loaded for a set of families.
 * New families are batched and flushed in groups to keep URLs short.
 * Font files are force-downloaded via document.fonts.load().
 */
export function loadGoogleFontPreview(families: string[]) {
  const newFamilies = families.filter(f => !loadedFamilies.has(f));
  if (newFamilies.length === 0) return;

  for (const f of newFamilies) {
    loadedFamilies.add(f);
    pendingFamilies.push(f);

    if (pendingFamilies.length >= BATCH_SIZE) {
      flushPending();
    }
  }

  // Flush remaining
  flushPending();
}

/** Remove all preview <link> elements and reset state */
export function resetGoogleFontPreview() {
  loadedFamilies.clear();
  pendingFamilies = [];

  for (let i = 0; i < batchIndex; i++) {
    document.getElementById(`${STYLE_PREFIX}${i}`)?.remove();
  }

  batchIndex = 0;
}

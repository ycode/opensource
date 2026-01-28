/**
 * DOM Utility Functions
 * 
 * Helpers for DOM manipulation, particularly for cross-document operations
 * like cloning elements from iframes.
 */

/** Maximum recursion depth for style copying (performance optimization) */
const MAX_STYLE_COPY_DEPTH = 10;

/** Maximum number of children to process per level (performance optimization) */
const MAX_CHILDREN_PER_LEVEL = 50;

/**
 * Recursively copies ALL computed styles from original elements to cloned elements.
 * This ensures the clone looks identical even when moved to a different document.
 * 
 * Use this when cloning elements from an iframe to the parent document, since
 * CSS rules from the iframe's stylesheets won't apply in the parent.
 * 
 * Performance optimizations:
 * - Limited recursion depth to prevent slow cloning of deeply nested elements
 * - Limited children per level to handle very wide elements
 * 
 * @param original - The original element from the source document
 * @param clone - The cloned element to apply styles to
 * @param sourceWindow - The window object of the source document (for getComputedStyle)
 * @param depth - Current recursion depth (internal use)
 */
export function copyComputedStyles(
  original: Element,
  clone: Element,
  sourceWindow: Window,
  depth: number = 0
): void {
  // Check if elements are valid
  if (!original || !clone) return;
  if (original.nodeType !== 1 || clone.nodeType !== 1) return;
  
  // Performance: limit recursion depth
  if (depth > MAX_STYLE_COPY_DEPTH) return;
  
  const originalEl = original as HTMLElement;
  const cloneEl = clone as HTMLElement;

  try {
    const computedStyle = sourceWindow.getComputedStyle(originalEl);
    
    // Iterate through ALL computed style properties
    // This is the most reliable way to copy styles across documents
    const len = computedStyle.length;
    for (let i = 0; i < len; i++) {
      const propName = computedStyle[i];
      const propValue = computedStyle.getPropertyValue(propName);
      if (propValue) {
        cloneEl.style.setProperty(propName, propValue);
      }
    }
  } catch (e) {
    // Fallback: try to copy individual critical properties
    try {
      const cs = sourceWindow.getComputedStyle(originalEl);
      cloneEl.style.color = cs.color;
      cloneEl.style.backgroundColor = cs.backgroundColor;
      cloneEl.style.fontFamily = cs.fontFamily;
      cloneEl.style.fontSize = cs.fontSize;
      cloneEl.style.fontWeight = cs.fontWeight;
    } catch {
      // Ignore
    }
  }

  // Recursively process children (with limits for performance)
  const originalChildren = original.children;
  const cloneChildren = clone.children;
  const childCount = Math.min(originalChildren.length, cloneChildren.length, MAX_CHILDREN_PER_LEVEL);
  
  for (let i = 0; i < childCount; i++) {
    copyComputedStyles(originalChildren[i], cloneChildren[i], sourceWindow, depth + 1);
  }
}

/**
 * Clones an element from an iframe and prepares it for use in the parent document.
 * Copies all computed styles to ensure visual fidelity.
 * 
 * @param element - The element to clone from the iframe
 * @param iframeWindow - The iframe's window object
 * @returns The cloned element with inline styles
 */
export function cloneElementFromIframe(
  element: HTMLElement,
  iframeWindow: Window
): HTMLElement {
  // Clone with all content
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Remove data attributes that might cause conflicts
  clone.removeAttribute('data-layer-id');
  const dataLayerElements = clone.querySelectorAll('[data-layer-id]');
  dataLayerElements.forEach(el => el.removeAttribute('data-layer-id'));
  
  // Copy all computed styles
  copyComputedStyles(element, clone, iframeWindow);
  
  return clone;
}

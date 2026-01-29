/**
 * Drag Cursor Utilities
 * 
 * Centralized cursor management during drag operations.
 * Uses multiple approaches to ensure the cursor is set correctly:
 * 1. Style tag with !important for global override
 * 2. Direct style on body elements for immediate effect
 */

const CURSOR_STYLE_ID = 'drag-cursor-override';

/**
 * Set the cursor to "grabbing" globally during a drag operation.
 * Applies to both the main document and optionally an iframe document.
 */
export function setDragCursor(iframeDoc?: Document | null): void {
  // Main document - style tag
  let styleEl = document.getElementById(CURSOR_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = CURSOR_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = 'html, body, * { cursor: grabbing !important; }';
  
  // Main document - direct body style for immediate effect
  document.body.style.cursor = 'grabbing';
  document.documentElement.style.cursor = 'grabbing';
  
  // Iframe document (if provided)
  if (iframeDoc?.head) {
    const iframeStyleId = `${CURSOR_STYLE_ID}-iframe`;
    let iframeStyleEl = iframeDoc.getElementById(iframeStyleId) as HTMLStyleElement | null;
    if (!iframeStyleEl) {
      iframeStyleEl = iframeDoc.createElement('style');
      iframeStyleEl.id = iframeStyleId;
      iframeDoc.head.appendChild(iframeStyleEl);
    }
    iframeStyleEl.textContent = 'html, body, * { cursor: grabbing !important; }';
    
    // Direct body style for immediate effect
    if (iframeDoc.body) {
      iframeDoc.body.style.cursor = 'grabbing';
    }
    if (iframeDoc.documentElement) {
      iframeDoc.documentElement.style.cursor = 'grabbing';
    }
  }
}

/**
 * Clear the grabbing cursor override, restoring normal cursor behavior.
 */
export function clearDragCursor(iframeDoc?: Document | null): void {
  // Main document - remove style tag
  document.getElementById(CURSOR_STYLE_ID)?.remove();
  
  // Main document - clear direct styles
  document.body.style.cursor = '';
  document.documentElement.style.cursor = '';
  
  // Iframe document (if provided)
  if (iframeDoc) {
    iframeDoc.getElementById(`${CURSOR_STYLE_ID}-iframe`)?.remove();
    
    // Clear direct styles
    if (iframeDoc.body) {
      iframeDoc.body.style.cursor = '';
    }
    if (iframeDoc.documentElement) {
      iframeDoc.documentElement.style.cursor = '';
    }
  }
}

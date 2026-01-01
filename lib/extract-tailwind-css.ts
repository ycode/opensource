/**
 * Extracts generated canvas CSS from the document
 * Used to save CSS for published pages
 */
export function extractCanvasCSS(): string | null {
  // Find all style tags we created for canvas CSS
  const styleTags = document.querySelectorAll('style[data-canvas-css="true"]');
  
  if (styleTags.length === 0) {
    console.warn('No canvas CSS style tags found');
    return null;
  }
  
  let css = '';
  styleTags.forEach(tag => {
    css += tag.textContent || '';
  });
  
  return css.trim() || null;
}

/**
 * @deprecated Use extractCanvasCSS instead
 */
export function extractTailwindCSS(): string | null {
  return extractCanvasCSS();
}

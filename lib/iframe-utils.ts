/**
 * Iframe Coordinate Utilities
 * 
 * Shared utilities for converting coordinates between iframe and window
 * coordinate systems. Used by drag-and-drop operations that span the
 * canvas iframe boundary.
 */

/**
 * Get the current scale factor applied to the iframe (via its parent wrapper).
 * The zoom is applied as CSS zoom on the wrapper div, not the iframe itself.
 */
export function getIframeScale(iframe: HTMLIFrameElement): number {
  const wrapper = iframe.parentElement;
  // Read from CSS zoom property
  const zoomValue = wrapper?.style.zoom;
  if (zoomValue) {
    const parsed = parseFloat(zoomValue);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  // Fallback to transform scale
  const transform = wrapper?.style.transform || '';
  const match = transform.match(/scale\(([\d.]+)\)/);
  return match ? parseFloat(match[1]) : 1;
}

/**
 * Convert iframe-relative coordinates to window coordinates.
 * 
 * @param iframe - The canvas iframe element
 * @param iframeX - X coordinate in iframe's internal coordinate system
 * @param iframeY - Y coordinate in iframe's internal coordinate system
 * @returns Coordinates in the parent window's coordinate system
 */
export function iframeToWindowCoords(
  iframe: HTMLIFrameElement,
  iframeX: number,
  iframeY: number
): { windowX: number; windowY: number } {
  const iframeRect = iframe.getBoundingClientRect();
  const scale = getIframeScale(iframe);
  return {
    windowX: iframeRect.left + (iframeX * scale),
    windowY: iframeRect.top + (iframeY * scale),
  };
}

/**
 * Convert window coordinates to iframe-relative coordinates.
 * 
 * @param iframe - The canvas iframe element
 * @param windowX - X coordinate in window's coordinate system
 * @param windowY - Y coordinate in window's coordinate system
 * @returns Coordinates in the iframe's internal coordinate system
 */
export function windowToIframeCoords(
  iframe: HTMLIFrameElement,
  windowX: number,
  windowY: number
): { iframeX: number; iframeY: number } {
  const iframeRect = iframe.getBoundingClientRect();
  const scale = getIframeScale(iframe);
  return {
    iframeX: (windowX - iframeRect.left) / scale,
    iframeY: (windowY - iframeRect.top) / scale,
  };
}

/**
 * Check if window coordinates are within the iframe's visible bounds.
 */
export function isOverIframe(
  iframe: HTMLIFrameElement,
  windowX: number,
  windowY: number
): boolean {
  const iframeRect = iframe.getBoundingClientRect();
  return (
    windowX >= iframeRect.left &&
    windowX <= iframeRect.right &&
    windowY >= iframeRect.top &&
    windowY <= iframeRect.bottom
  );
}

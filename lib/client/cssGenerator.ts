/**
 * Client-Side CSS Generator using Tailwind Browser CDN
 *
 * Uses @tailwindcss/browser in a hidden iframe to generate CSS
 * This avoids all WASM bundling issues
 */

'use client';

import type { Component, Layer } from '@/types';
import { DEFAULT_TEXT_STYLES } from '@/lib/text-format-utils';

/**
 * Extract all classes from layers recursively
 * Includes classes from layer.classes, layer.textStyles, and DEFAULT_TEXT_STYLES
 * Tracks processed componentIds to avoid duplicate extraction
 */
function extractClassesFromLayers(layers: Layer[]): Set<string> {
  const classes = new Set<string>();
  const processedComponentIds = new Set<string>();

  // Helper to extract classes from a string or array
  const extractClasses = (classValue: string | string[] | undefined) => {
    if (!classValue) return;

    if (Array.isArray(classValue)) {
      classValue.forEach(cls => {
        if (cls && typeof cls === 'string') {
          cls.split(/\s+/).forEach(c => c.trim() && classes.add(c.trim()));
        }
      });
    } else if (typeof classValue === 'string') {
      classValue.split(/\s+/).forEach(cls => cls.trim() && classes.add(cls.trim()));
    }
  };

  function processLayer(layer: Layer): void {
    if (layer.settings?.hidden) return;

    // Skip if we've already processed this component
    if (layer.componentId) {
      if (processedComponentIds.has(layer.componentId)) return;
      processedComponentIds.add(layer.componentId);
    }

    // Extract layer classes
    extractClasses(layer.classes);

    // Extract text style classes (from layer.textStyles)
    if (layer.textStyles) {
      Object.values(layer.textStyles).forEach(style => {
        extractClasses(style.classes);
      });
    }

    // Extract default text style classes (if layer has text content)
    if (layer.variables?.text) {
      Object.values(DEFAULT_TEXT_STYLES).forEach(style => {
        extractClasses(style.classes);
      });
    }

    if (layer.children && Array.isArray(layer.children)) {
      layer.children.forEach(child => processLayer(child));
    }
  }

  layers.forEach(layer => processLayer(layer));
  return classes;
}

/**
 * Generate CSS using Tailwind Browser CDN in a hidden iframe
 */
export async function generateCSS(layers: Layer[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const classes = extractClassesFromLayers(layers);
    const classesArray = Array.from(classes);

    if (classesArray.length === 0) {
      resolve('/* No classes to generate */');
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const timeout = setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      reject(new Error('CSS generation timeout'));
    }, 30000);

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'css-ready') {
        clearTimeout(timeout);
        window.removeEventListener('message', handleMessage);
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        resolve(event.data.css);
      } else if (event.data.type === 'css-error') {
        clearTimeout(timeout);
        window.removeEventListener('message', handleMessage);
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        reject(new Error(event.data.error));
      }
    };
    window.addEventListener('message', handleMessage);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      clearTimeout(timeout);
      window.removeEventListener('message', handleMessage);
      document.body.removeChild(iframe);
      reject(new Error('Cannot access iframe document'));
      return;
    }

    const htmlContent = classesArray.map(cls => `<div class="${cls}"></div>`).join('\n');

    iframeDoc.open();
    iframeDoc.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <style type="text/tailwindcss"></style>
</head>
<body>
  ${htmlContent}
  <script>
    let retryCount = 0;
    const maxRetries = 100;

    function extractCSS() {
      try {
        retryCount++;
        const styleTags = Array.from(document.querySelectorAll('style'));

        const tailwindStyle = styleTags.find(style => {
          const css = style.textContent || '';
          return css.length > 100 && (
            css.includes('*,::after,::before') ||
            css.includes('tailwindcss') ||
            css.includes('--tw-')
          );
        });

        if (tailwindStyle && tailwindStyle.textContent) {
          window.parent.postMessage({
            type: 'css-ready',
            css: tailwindStyle.textContent
          }, '*');
        } else if (retryCount >= maxRetries) {
          window.parent.postMessage({
            type: 'css-error',
            error: 'CSS generation timeout'
          }, '*');
        } else {
          setTimeout(extractCSS, 100);
        }
      } catch (error) {
        window.parent.postMessage({
          type: 'css-error',
          error: error.message || 'Unknown error'
        }, '*');
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(extractCSS, 1000);
      });
    } else {
      setTimeout(extractCSS, 1000);
    }
  </script>
</body>
</html>
    `);
    iframeDoc.close();
  });
}

/**
 * Save CSS to settings via API and update the settings store
 */
export async function saveCSS(css: string, key: 'draft_css' | 'published_css'): Promise<void> {
  const response = await fetch(`/ycode/api/settings/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: css }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save CSS: ${response.statusText}`);
  }

  // Update settings store to keep it in sync
  const { useSettingsStore } = await import('@/stores/useSettingsStore');
  useSettingsStore.getState().updateSetting(key, css);
}

/**
 * Collect all layers including component layers for CSS generation
 * Includes both saved components and component drafts (unsaved edits)
 */
async function collectAllLayers(pageLayers: Layer[]): Promise<Layer[]> {
  const { useComponentsStore } = await import('@/stores/useComponentsStore');
  const { components, componentDrafts } = useComponentsStore.getState();

  // Track which components have drafts
  const draftComponentIds = new Set(Object.keys(componentDrafts));

  // Collect layers from all components (prefer drafts over saved versions)
  const componentLayers: Layer[] = [];

  // Add component drafts first (these are the latest edits)
  Object.values(componentDrafts).forEach((layers) => {
    if (layers && Array.isArray(layers)) {
      componentLayers.push(...layers);
    }
  });

  // Add saved components that don't have drafts
  components.forEach((component: Component) => {
    if (!draftComponentIds.has(component.id) && component.layers && Array.isArray(component.layers)) {
      componentLayers.push(...component.layers);
    }
  });

  // Combine page layers and component layers
  return [...pageLayers, ...componentLayers];
}

/**
 * Generate CSS and save it to draft_css
 * Automatically includes component layers for comprehensive CSS generation
 */
export async function generateAndSaveCSS(layers: Layer[]): Promise<string> {
  // Collect all layers including component layers
  const allLayers = await collectAllLayers(layers);
  const css = await generateCSS(allLayers);
  await saveCSS(css, 'draft_css');
  return css;
}

/**
 * Client-Side CSS Generator using Tailwind Browser CDN
 *
 * Uses @tailwindcss/browser in a hidden iframe to generate CSS
 * This avoids all WASM bundling issues
 */

'use client';

import type { Layer } from '@/types';

/**
 * Extract all classes from layers recursively
 */
function extractClassesFromLayers(layers: Layer[]): Set<string> {
  const classes = new Set<string>();

  function processLayer(layer: Layer): void {
    if (layer.settings?.hidden) return;

    if (layer.classes) {
      if (Array.isArray(layer.classes)) {
        layer.classes.forEach(cls => {
          if (cls && typeof cls === 'string') {
            cls.split(/\s+/).forEach(c => c.trim() && classes.add(c.trim()));
          }
        });
      } else if (typeof layer.classes === 'string') {
        layer.classes.split(/\s+/).forEach(cls => cls.trim() && classes.add(cls.trim()));
      }
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
  <style type="text/tailwindcss">
    @theme {
      --breakpoint-max-lg: 1023px;
      --breakpoint-max-md: 767px;
    }
  </style>
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
  const response = await fetch(`/api/settings/${key}`, {
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
 * Generate CSS and save it to draft_css
 */
export async function generateAndSaveCSS(layers: Layer[]): Promise<string> {
  const css = await generateCSS(layers);
  await saveCSS(css, 'draft_css');
  return css;
}


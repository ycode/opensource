'use client';

/**
 * Client-side component thumbnail capture and upload.
 * Renders layers in a hidden iframe, captures with html-to-image,
 * and uploads to the server for WebP conversion + storage.
 *
 * This is a standalone module (not a hook) so it can be called from
 * Zustand stores and other non-React contexts.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { toBlob } from 'html-to-image';

import LayerRenderer from '@/components/LayerRenderer';
import { getCanvasIframeHtml } from '@/lib/canvas-utils';
import { componentsApi } from '@/lib/api';
import { serializeLayers } from '@/lib/layer-utils';
import { DEFAULT_ASSETS } from '@/lib/asset-constants';
import type { Layer, Component } from '@/types';

/** Default placeholder image for failed CORS fetches (base64 data URI) */
const DEFAULT_IMAGE_PLACEHOLDER = DEFAULT_ASSETS.IMAGE;

/** Viewport width for the thumbnail render */
const THUMBNAIL_VIEWPORT_WIDTH = 1280;

/** Time to wait for Tailwind CDN to process styles (ms) */
const TAILWIND_INIT_DELAY = 1500;

/** Track in-progress generations to prevent duplicates */
const pendingGenerations = new Set<string>();

/**
 * Render layers in a hidden iframe and capture as an image blob.
 * Creates and destroys the iframe automatically.
 */
async function captureLayersAsBlob(
  layers: Layer[],
  components: Component[]
): Promise<Blob | null> {
  // Resolve component instances
  const { layers: resolvedLayers } = serializeLayers(layers, components);

  // Create hidden offscreen iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = `${THUMBNAIL_VIEWPORT_WIDTH}px`;
  iframe.style.height = '800px';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  let root: Root | null = null;

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Could not access iframe document');

    // Write shared canvas HTML template
    doc.open();
    doc.write(getCanvasIframeHtml('thumbnail-mount'));
    doc.close();

    // Wait for Tailwind CDN to initialize
    await new Promise((resolve) => setTimeout(resolve, 200));

    const mountPoint = doc.getElementById('thumbnail-mount');
    if (!mountPoint) throw new Error('Mount point not found');

    // Render layers into the iframe
    root = createRoot(mountPoint);
    root.render(
      <div
        id="component-preview"
        style={{
          background: 'white',
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <LayerRenderer
            layers={resolvedLayers}
            isEditMode={false}
            isPublished={false}
            pageId="thumbnail"
          />
        </div>
      </div>
    );

    // Wait for React to render + Tailwind to process all classes
    await new Promise((resolve) => setTimeout(resolve, TAILWIND_INIT_DELAY));

    // Capture the rendered content
    const target = doc.getElementById('component-preview');
    if (!target) throw new Error('Component preview element not found');

    const blob = await toBlob(target, {
      backgroundColor: '#ffffff',
      pixelRatio: 1,
      skipFonts: false,
      imagePlaceholder: DEFAULT_IMAGE_PLACEHOLDER, // Fallback for images that fail CORS fetch
    });

    return blob;
  } finally {
    // Cleanup
    if (root) {
      try {
        root.unmount();
      } catch {
        // Ignore unmount errors during cleanup
      }
    }
    document.body.removeChild(iframe);
  }
}

/**
 * Generate and upload a component thumbnail.
 * Fire-and-forget: runs in background, deduplicates concurrent calls per component.
 * @returns The public URL of the uploaded thumbnail, or null on failure
 */
export async function generateComponentThumbnail(
  componentId: string,
  layers: Layer[],
  components: Component[] = []
): Promise<string | null> {
  // Skip if already generating for this component
  if (pendingGenerations.has(componentId)) return null;
  pendingGenerations.add(componentId);

  try {
    const blob = await captureLayersAsBlob(layers, components);
    if (!blob) return null;

    const result = await componentsApi.uploadThumbnail(componentId, blob);
    if (result.error) {
      console.error('Failed to upload thumbnail:', result.error);
      return null;
    }

    return result.data?.thumbnail_url ?? null;
  } catch (error) {
    console.error('Error generating component thumbnail:', error);
    return null;
  } finally {
    pendingGenerations.delete(componentId);
  }
}

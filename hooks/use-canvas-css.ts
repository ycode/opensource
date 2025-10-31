'use client';

import { useEffect } from 'react';
import { generateCanvasCSS } from '@/lib/canvas-css-generator';
import type { Layer } from '@/types';

/**
 * Hook to generate and inject CSS for arbitrary value classes on canvas
 * Removes previous CSS and injects fresh CSS whenever layers change
 */
export function useCanvasCSS(layers: Layer[], pageId: string) {
  useEffect(() => {
    const styleId = `canvas-css-${pageId}`;
    
    // Remove existing style tag
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Generate new CSS from layers
    const css = generateCanvasCSS(layers);
    
    if (css) {
      // Inject new style tag
      const style = document.createElement('style');
      style.id = styleId;
      style.setAttribute('data-canvas-css', 'true');
      style.textContent = css;
      document.head.appendChild(style);
      
      console.log('🎨 Canvas CSS generated:', {
        pageId,
        cssLength: css.length,
        rulesCount: css.split('\n').filter(Boolean).length,
        preview: css.substring(0, 200) + (css.length > 200 ? '...' : '')
      });
    }
    
    // Cleanup on unmount
    return () => {
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    };
  }, [layers, pageId]);
}



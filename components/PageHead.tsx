'use client';

import { useEffect } from 'react';

interface PageHeadProps {
  css: string;
}

/**
 * Client component to inject CSS into <head>
 * Used for both preview and published pages
 * We use this approach because Next.js doesn't allow direct <head> manipulation in Server Components
 */
export default function PageHead({ css }: PageHeadProps) {
  useEffect(() => {
    if (!css) return;

    // Create style element
    const styleElement = document.createElement('style');
    styleElement.id = 'ycode-styles';
    styleElement.textContent = css;

    // Inject into head
    document.head.appendChild(styleElement);

    // Cleanup on unmount
    return () => {
      const existingStyle = document.getElementById('ycode-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, [css]);

  return null; // This component doesn't render anything visible
}

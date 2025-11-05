'use client';

import { useEffect } from 'react';

interface PublishedPageHeadProps {
  css: string;
}

/**
 * Client component to inject CSS into <head>
 * We use this approach because Next.js doesn't allow direct <head> manipulation in Server Components
 */
export default function PublishedPageHead({ css }: PublishedPageHeadProps) {
  useEffect(() => {
    if (!css) return;

    // Create style element
    const styleElement = document.createElement('style');
    styleElement.id = 'ycode-published-styles';
    styleElement.textContent = css;
    
    // Inject into head
    document.head.appendChild(styleElement);
    
    // Cleanup on unmount
    return () => {
      const existingStyle = document.getElementById('ycode-published-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, [css]);
  
  return null; // This component doesn't render anything visible
}


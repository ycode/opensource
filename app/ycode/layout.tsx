'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import YCodeBuilder from './components/YCodeBuilderMain';

/**
 * YCode Editor Layout
 * 
 * This layout wraps all /ycode routes and renders YCodeBuilder once.
 * By keeping YCodeBuilder at the layout level, it persists across route changes,
 * preventing remounts and avoiding duplicate API calls on navigation.
 * 
 * Routes:
 * - /ycode - Base editor
 * - /ycode/pages/[id] - Page editing
 * - /ycode/layers/[id] - Layer editing
 * - /ycode/collections/[id] - Collection management
 * - /ycode/components/[id] - Component editing
 * 
 * Excluded routes:
 * - /ycode/preview - Preview routes are excluded and render independently
 * 
 * YCodeBuilder uses useEditorUrl() to detect route changes and update
 * the UI accordingly without remounting.
 */
export default function YCodeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Ensure dark mode is applied immediately on mount (before React hydrates)
  useEffect(() => {
    const root = document.documentElement;
    if (pathname?.startsWith('/ycode') && !pathname?.startsWith('/ycode/preview')) {
      root.classList.add('dark');
    }
  }, [pathname]);
  
  // Exclude preview routes from YCodeBuilder
  // Preview routes should render independently without the editor UI
  if (pathname?.startsWith('/ycode/preview')) {
    return <>{children}</>;
  }
  
  // YCodeBuilder handles all rendering based on URL
  // Children are ignored - routes are just for URL structure
  return <YCodeBuilder />;
}

'use client';

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
 * YCodeBuilder uses useEditorUrl() to detect route changes and update
 * the UI accordingly without remounting.
 */
export default function YCodeLayout({ children }: { children: React.ReactNode }) {
  // YCodeBuilder handles all rendering based on URL
  // Children are ignored - routes are just for URL structure
  return <YCodeBuilder />;
}

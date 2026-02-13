'use client';

import { Suspense, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import YCodeBuilder from './components/YCodeBuilderMain';
import { useEditorUrl } from '@/hooks/use-editor-url';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * YCode Editor Layout (Client Component)
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
 * - /ycode/settings - Settings pages
 * - /ycode/localization - Localization pages
 * - /ycode/profile - Profile pages
 *
 * Excluded routes:
 * - /ycode/preview - Preview routes are excluded and render independently
 *
 * YCodeBuilder uses useEditorUrl() to detect route changes and update
 * the UI accordingly without remounting.
 */

// Inner component that uses useSearchParams (via useEditorUrl)
function YCodeLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { routeType } = useEditorUrl();
  const { initialize } = useAuthStore();

  // Initialize auth only within /ycode routes (not on public pages)
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Exclude standalone routes from YCodeBuilder
  // These routes should render independently without the editor UI
  const prefixRoutes = ['/ycode/preview', '/ycode/devtools/'];
  const exactRoutes = ['/ycode/welcome', '/ycode/accept-invite'];

  if (
    prefixRoutes.some(route => pathname?.startsWith(route))
    || exactRoutes.includes(pathname || '')
  ) {
    return <>{children}</>;
  }

  // For settings, localization, profile, forms, and integrations routes, pass children to YCodeBuilder so it can render them
  if (routeType === 'settings' || routeType === 'localization' || routeType === 'profile' || routeType === 'forms' || routeType === 'integrations') {
    return <YCodeBuilder>{children}</YCodeBuilder>;
  }

  // YCodeBuilder handles all rendering based on URL
  // Children are ignored - routes are just for URL structure
  return <YCodeBuilder />;
}

// Client layout wrapped in Suspense to handle useSearchParams
// Required by Next.js 14+ to prevent static rendering bailout
export default function YCodeLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <YCodeLayoutInner>{children}</YCodeLayoutInner>
    </Suspense>
  );
}

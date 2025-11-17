'use client';

import YCodeBuilder from '../YCodeBuilderMain';

/**
 * Dynamic route for editing a specific component
 * URL: /ycode/components/[id]
 *
 * This route renders the same YCodeBuilder component.
 * The main editor reads the URL and navigates to the component automatically.
 */
export default function ComponentRoute() {
  return <YCodeBuilder />;
}


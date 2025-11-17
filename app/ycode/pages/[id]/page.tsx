'use client';

import YCodeBuilder from '../../components/YCodeBuilderMain';

/**
 * Dynamic route for viewing a specific page
 * URL: /ycode/pages/[id]
 *
 * This route renders the same YCodeBuilder component.
 * The main editor reads the URL and shows the pages panel.
 */
export default function PageRoute() {
  return <YCodeBuilder />;
}


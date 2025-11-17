'use client';

import YCodeBuilder from '../../../components/YCodeBuilderMain';

/**
 * Dynamic route for editing page settings
 * URL: /ycode/pages/[id]/edit
 *
 * This route renders the same YCodeBuilder component.
 * The main editor reads the URL and shows the page settings panel.
 * Tabs (General, SEO, Custom Code) are handled on the front-end.
 */
export default function PageEditRoute() {
  return <YCodeBuilder />;
}


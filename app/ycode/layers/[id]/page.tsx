'use client';

import YCodeBuilder from '../../components/YCodeBuilderMain';

/**
 * Dynamic route for viewing page layers
 * URL: /ycode/layers/[id]
 *
 * This route renders the same YCodeBuilder component.
 * The main editor reads the URL and shows the layers panel.
 */
export default function LayersRoute() {
  return <YCodeBuilder />;
}


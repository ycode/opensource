'use client';

import YCodeBuilder from '../../components/YCodeBuilderMain';

/**
 * Dynamic route for viewing/editing a specific collection
 * URL: /ycode/collections/[id]?page=1
 *
 * This route renders the same YCodeBuilder component.
 * The main editor reads the URL and navigates to the collection automatically.
 */
export default function CollectionRoute() {
  return <YCodeBuilder />;
}

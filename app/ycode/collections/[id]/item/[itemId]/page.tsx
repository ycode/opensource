'use client';

import YCodeBuilder from '../../../../components/YCodeBuilderMain';

/**
 * Dynamic route for editing a collection item
 * URL: /ycode/collections/[id]/item/[itemId]
 * 
 * itemId can be:
 * - 'new' for creating new items
 * - r_id string for editing existing items
 */
export default function CollectionItemRoute() {
  return <YCodeBuilder />;
}


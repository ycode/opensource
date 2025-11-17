'use client';

import YCodeBuilder from './components/YCodeBuilderMain';

/**
 * Base route for YCode editor
 * URL: /ycode
 * 
 * This route renders the same YCodeBuilder component as all other routes.
 * By using the same component everywhere, we prevent remounts during navigation.
 */
export default function YCodeEditorRoute() {
  return <YCodeBuilder />;
}


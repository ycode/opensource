'use client';

import { useEffect } from 'react';

/**
 * Reports document content height to parent window
 * Used in preview mode to enable proper zoom calculations
 */
export default function ContentHeightReporter() {
  useEffect(() => {
    // Only run if we're in an iframe
    if (window.self === window.top) return;

    const reportHeight = () => {
      const height = document.documentElement.scrollHeight;
      
      window.parent.postMessage(
        {
          type: 'CONTENT_HEIGHT',
          payload: { height },
        },
        '*'
      );
    };

    // Report initial height
    reportHeight();

    // Report height when content changes
    const resizeObserver = new ResizeObserver(reportHeight);
    resizeObserver.observe(document.body);

    // Also report on window resize (for responsive content)
    window.addEventListener('resize', reportHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', reportHeight);
    };
  }, []);

  return null;
}

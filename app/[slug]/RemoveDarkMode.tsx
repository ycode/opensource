'use client';

import { useEffect } from 'react';

/**
 * Remove dark mode class from <html> element for published pages
 * The root layout applies dark mode for the editor, but published pages should use light mode
 */
export default function RemoveDarkMode() {
  useEffect(() => {
    // Remove dark class from html element
    document.documentElement.classList.remove('dark');
    
    // Cleanup: restore dark mode when navigating away
    return () => {
      document.documentElement.classList.add('dark');
    };
  }, []);
  
  return null;
}


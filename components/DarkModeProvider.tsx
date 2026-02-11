'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * DarkModeProvider
 * 
 * Client component that applies dark mode class to <html> element
 * based on the current pathname. This avoids using headers() in
 * the root layout which would force all pages to be dynamic.
 * 
 * Dark mode is applied for /ycode/* routes except /ycode/preview/*
 */
export default function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  useEffect(() => {
    const isPreviewRoute = pathname?.startsWith('/ycode/preview');
    const isDarkMode = !isPreviewRoute && pathname?.startsWith('/ycode');
    
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [pathname]);

  return <>{children}</>;
}

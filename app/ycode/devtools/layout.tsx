'use client';

/**
 * Devtools Layout
 *
 * Requires authentication for all /ycode/devtools/* pages.
 * Redirects to /ycode (login screen) if not authenticated.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/hooks/use-auth-session';
import BuilderLoading from '@/components/BuilderLoading';

export default function DevtoolsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, isLoading } = useAuthSession();

  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/ycode');
    }
  }, [isLoading, session, router]);

  if (isLoading || !session) {
    return <BuilderLoading message="Checking setup" />;
  }

  return <>{children}</>;
}

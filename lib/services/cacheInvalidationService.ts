/**
 * Cache Invalidation Service
 * 
 * Handles CDN cache invalidation for published pages
 */

/**
 * Invalidate cache for a specific page by slug
 */
export async function invalidatePage(slug: string): Promise<boolean> {
  const revalidateSecret = process.env.REVALIDATE_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!revalidateSecret) {
    console.warn('REVALIDATE_SECRET not configured - skipping cache invalidation');
    return false;
  }

  try {
    const response = await fetch(`${appUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tag: `page-${slug}`,
        secret: revalidateSecret,
      }),
    });

    if (response.ok) {
      console.log(`Cache invalidated for page: ${slug}`);
      return true;
    }

    console.error(`Cache invalidation failed for page: ${slug}`, {
      status: response.status,
      body: await response.text(),
    });

    return false;
  } catch (error) {
    console.error('Cache invalidation error:', error);
    return false;
  }
}

/**
 * Invalidate cache for multiple pages
 */
export async function invalidatePages(slugs: string[]): Promise<boolean> {
  const results = await Promise.all(slugs.map((slug) => invalidatePage(slug)));
  return results.every((result) => result);
}


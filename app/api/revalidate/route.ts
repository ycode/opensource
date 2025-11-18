import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { noCache } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tag, secret } = body;

    // Verify secret token
    if (secret !== process.env.REVALIDATE_SECRET) {
      return noCache(
        { error: 'Invalid secret' },
        401
      );
    }

    if (!tag) {
      return noCache(
        { error: 'Tag is required' },
        400
      );
    }

    // Revalidate the cache for this tag
    revalidateTag(tag);

    return noCache({ 
      revalidated: true, 
      tag,
      now: Date.now() 
    });
  } catch (error) {
    return noCache(
      { error: 'Error revalidating' },
      500
    );
  }
}

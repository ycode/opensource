/**
 * Asset Usage API Route
 *
 * GET /api/assets/[id]/usage - Get usage counts for an asset
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAssetUsage } from '@/lib/asset-usage-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      );
    }

    const usage = await getAssetUsage(id);

    return NextResponse.json({ data: usage });
  } catch (error) {
    console.error('Error fetching asset usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset usage' },
      { status: 500 }
    );
  }
}

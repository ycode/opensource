import { NextRequest, NextResponse } from 'next/server';
import {
  getWebhookById,
  getWebhookDeliveries,
} from '@/lib/repositories/webhookRepository';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /ycode/api/webhooks/[id]/deliveries
 * Get delivery logs for a webhook
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Verify webhook exists
    const webhook = await getWebhookById(id);
    if (!webhook) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    const { deliveries, total } = await getWebhookDeliveries(id, { limit, offset });

    return NextResponse.json({
      data: deliveries,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + deliveries.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching webhook deliveries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook deliveries' },
      { status: 500 }
    );
  }
}

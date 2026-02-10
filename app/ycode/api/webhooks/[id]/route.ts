import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import {
  getWebhookById,
  updateWebhook,
  deleteWebhook,
  createWebhookDelivery,
  updateWebhookDelivery,
  markWebhookTriggered,
  type UpdateWebhookData,
} from '@/lib/repositories/webhookRepository';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /ycode/api/webhooks/[id]
 * Get a specific webhook
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const webhook = await getWebhookById(id);

    if (!webhook) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: webhook });
  } catch (error) {
    console.error('Error fetching webhook:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook' },
      { status: 500 }
    );
  }
}

/**
 * PUT /ycode/api/webhooks/[id]
 * Update a webhook
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await getWebhookById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    const updates: UpdateWebhookData = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.url !== undefined) updates.url = body.url;
    if (body.events !== undefined) updates.events = body.events;
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.secret !== undefined) updates.secret = body.secret;

    // Validate URL if provided
    if (updates.url) {
      try {
        new URL(updates.url);
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        );
      }
    }

    const webhook = await updateWebhook(id, updates);

    return NextResponse.json({ data: webhook });
  } catch (error) {
    console.error('Error updating webhook:', error);
    return NextResponse.json(
      { error: 'Failed to update webhook' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /ycode/api/webhooks/[id]
 * Delete a webhook
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    const existing = await getWebhookById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    await deleteWebhook(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    );
  }
}

/**
 * POST /ycode/api/webhooks/[id]
 * Test a webhook by sending a test event
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    const webhook = await getWebhookById(id);
    if (!webhook) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    // Create test payload
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Ycode',
        webhook_id: webhook.id,
        webhook_name: webhook.name,
      },
    };

    const payloadString = JSON.stringify(testPayload);

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Ycode-Webhook/1.0',
      'X-Ycode-Event': 'test',
    };

    // Add HMAC signature if secret is configured
    if (webhook.secret) {
      const signature = createHmac('sha256', webhook.secret)
        .update(payloadString)
        .digest('hex');
      headers['X-Ycode-Signature'] = `sha256=${signature}`;
    }

    // Create delivery log
    const delivery = await createWebhookDelivery({
      webhook_id: webhook.id,
      event_type: 'test',
      payload: testPayload,
      status: 'pending',
    });

    const startTime = Date.now();

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payloadString,
      });

      const duration = Date.now() - startTime;
      const responseBody = await response.text();

      // Update delivery log
      await updateWebhookDelivery(delivery.id, {
        status: response.ok ? 'success' : 'failed',
        response_status: response.status,
        response_body: responseBody.slice(0, 1000),
        duration_ms: duration,
      });

      // Update webhook trigger status
      await markWebhookTriggered(webhook.id, response.ok);

      if (response.ok) {
        return NextResponse.json({
          data: {
            success: true,
            status: response.status,
            duration_ms: duration,
            message: 'Test webhook sent successfully',
          },
        });
      } else {
        return NextResponse.json({
          data: {
            success: false,
            status: response.status,
            duration_ms: duration,
            message: `Webhook returned status ${response.status}`,
            response: responseBody.slice(0, 500),
          },
        });
      }
    } catch (fetchError) {
      const duration = Date.now() - startTime;

      // Update delivery log with error
      await updateWebhookDelivery(delivery.id, {
        status: 'failed',
        response_body: fetchError instanceof Error ? fetchError.message : 'Unknown error',
        duration_ms: duration,
      });

      // Increment failure count
      await markWebhookTriggered(webhook.id, false);

      return NextResponse.json({
        data: {
          success: false,
          duration_ms: duration,
          message: fetchError instanceof Error ? fetchError.message : 'Failed to connect',
        },
      });
    }
  } catch (error) {
    console.error('Error testing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to test webhook' },
      { status: 500 }
    );
  }
}

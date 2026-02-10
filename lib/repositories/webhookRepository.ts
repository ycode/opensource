import { getSupabaseAdmin } from '../supabase-server';

/**
 * Webhook Repository
 *
 * Handles CRUD operations for webhooks and webhook delivery logs.
 */

// =============================================================================
// Types
// =============================================================================

export type WebhookEventType =
  | 'form.submitted'
  | 'site.published'
  | 'collection_item.created'
  | 'collection_item.updated'
  | 'collection_item.deleted'
  | 'page.created'
  | 'page.updated'
  | 'page.published'
  | 'page.deleted'
  | 'asset.uploaded'
  | 'asset.deleted';

export interface WebhookFilters {
  /** Filter form.submitted events to a specific form */
  form_id?: string | null;
  /** Filter collection_item.* events to a specific collection */
  collection_id?: string | null;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: WebhookEventType[];
  filters: WebhookFilters | null;
  enabled: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  duration_ms: number | null;
  created_at: string;
}

export interface CreateWebhookData {
  name: string;
  url: string;
  secret?: string;
  events: WebhookEventType[];
  filters?: WebhookFilters | null;
}

export interface UpdateWebhookData {
  name?: string;
  url?: string;
  secret?: string | null;
  events?: WebhookEventType[];
  filters?: WebhookFilters | null;
  enabled?: boolean;
}

export interface CreateWebhookDeliveryData {
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status?: 'pending' | 'success' | 'failed';
  attempts?: number;
}

export interface UpdateWebhookDeliveryData {
  response_status?: number;
  response_body?: string;
  status?: 'pending' | 'success' | 'failed';
  attempts?: number;
  duration_ms?: number;
}

// =============================================================================
// Webhook CRUD Operations
// =============================================================================

/**
 * Get all webhooks
 */
export async function getAllWebhooks(): Promise<Webhook[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('webhooks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch webhooks: ${error.message}`);
  }

  return (data || []).map(mapWebhookFromDb);
}

/**
 * Get webhook by ID
 */
export async function getWebhookById(id: string): Promise<Webhook | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('webhooks')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch webhook: ${error.message}`);
  }

  return data ? mapWebhookFromDb(data) : null;
}

/**
 * Get all enabled webhooks for a specific event type
 */
export async function getWebhooksForEvent(eventType: WebhookEventType): Promise<Webhook[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('webhooks')
    .select('*')
    .eq('enabled', true)
    .contains('events', [eventType]);

  if (error) {
    throw new Error(`Failed to fetch webhooks for event: ${error.message}`);
  }

  return (data || []).map(mapWebhookFromDb);
}

/**
 * Create a new webhook
 */
export async function createWebhook(webhookData: CreateWebhookData): Promise<Webhook> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('webhooks')
    .insert({
      name: webhookData.name,
      url: webhookData.url,
      secret: webhookData.secret || null,
      events: webhookData.events,
      filters: webhookData.filters || null,
      enabled: true,
      failure_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create webhook: ${error.message}`);
  }

  return mapWebhookFromDb(data);
}

/**
 * Update a webhook
 */
export async function updateWebhook(id: string, updates: UpdateWebhookData): Promise<Webhook> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.url !== undefined) updateData.url = updates.url;
  if (updates.secret !== undefined) updateData.secret = updates.secret;
  if (updates.events !== undefined) updateData.events = updates.events;
  if (updates.filters !== undefined) updateData.filters = updates.filters;
  if (updates.enabled !== undefined) updateData.enabled = updates.enabled;

  const { data, error } = await client
    .from('webhooks')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update webhook: ${error.message}`);
  }

  return mapWebhookFromDb(data);
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await client
    .from('webhooks')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete webhook: ${error.message}`);
  }
}

/**
 * Update webhook trigger timestamp and reset failure count on success
 */
export async function markWebhookTriggered(id: string, success: boolean): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  if (success) {
    await client
      .from('webhooks')
      .update({
        last_triggered_at: new Date().toISOString(),
        failure_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  } else {
    // Increment failure count
    await client.rpc('increment_webhook_failure_count', { webhook_id: id });
  }
}

/**
 * Increment webhook failure count (called when delivery fails)
 */
export async function incrementWebhookFailureCount(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Use raw SQL to increment
  const { error } = await client
    .from('webhooks')
    .update({
      failure_count: client.rpc('increment', { x: 1 }) as unknown as number,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  // Fallback: fetch and update if rpc fails
  if (error) {
    const webhook = await getWebhookById(id);
    if (webhook) {
      await client
        .from('webhooks')
        .update({
          failure_count: webhook.failure_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    }
  }
}

// =============================================================================
// Webhook Delivery Operations
// =============================================================================

/**
 * Create a webhook delivery log entry
 */
export async function createWebhookDelivery(
  deliveryData: CreateWebhookDeliveryData
): Promise<WebhookDelivery> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('webhook_deliveries')
    .insert({
      webhook_id: deliveryData.webhook_id,
      event_type: deliveryData.event_type,
      payload: deliveryData.payload,
      status: deliveryData.status || 'pending',
      attempts: deliveryData.attempts || 1,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create webhook delivery: ${error.message}`);
  }

  return data as WebhookDelivery;
}

/**
 * Update a webhook delivery
 */
export async function updateWebhookDelivery(
  id: string,
  updates: UpdateWebhookDeliveryData
): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await client
    .from('webhook_deliveries')
    .update(updates)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update webhook delivery: ${error.message}`);
  }
}

/**
 * Get deliveries for a specific webhook
 */
export async function getWebhookDeliveries(
  webhookId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ deliveries: WebhookDelivery[]; total: number }> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const limit = options.limit || 50;
  const offset = options.offset || 0;

  // Get total count
  const { count, error: countError } = await client
    .from('webhook_deliveries')
    .select('*', { count: 'exact', head: true })
    .eq('webhook_id', webhookId);

  if (countError) {
    throw new Error(`Failed to count webhook deliveries: ${countError.message}`);
  }

  // Get paginated results
  const { data, error } = await client
    .from('webhook_deliveries')
    .select('*')
    .eq('webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch webhook deliveries: ${error.message}`);
  }

  return {
    deliveries: (data || []) as WebhookDelivery[],
    total: count || 0,
  };
}

/**
 * Delete old webhook deliveries (cleanup)
 */
export async function deleteOldWebhookDeliveries(olderThanDays: number = 30): Promise<number> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const { data, error } = await client
    .from('webhook_deliveries')
    .delete()
    .lt('created_at', cutoffDate.toISOString())
    .select('id');

  if (error) {
    throw new Error(`Failed to delete old webhook deliveries: ${error.message}`);
  }

  return data?.length || 0;
}

// =============================================================================
// Helpers
// =============================================================================
 
function mapWebhookFromDb(data: any): Webhook {
  return {
    id: data.id,
    name: data.name,
    url: data.url,
    secret: data.secret,
    events: Array.isArray(data.events) ? data.events : [],
    filters: data.filters || null,
    enabled: data.enabled,
    last_triggered_at: data.last_triggered_at,
    failure_count: data.failure_count || 0,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

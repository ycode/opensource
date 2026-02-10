/**
 * MailerLite API Client
 *
 * Server-side functions for communicating with the MailerLite API.
 * Uses the v2 API at https://connect.mailerlite.com/api
 *
 * API Documentation: https://developers.mailerlite.com/docs/
 */

import type {
  MailerLiteGroup,
  MailerLiteField,
  MailerLiteSubscriber,
  MailerLitePaginatedResponse,
  MailerLiteConnection,
  MailerLiteFieldMapping,
} from './types';

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api';

// =============================================================================
// API Helpers
// =============================================================================

interface MailerLiteRequestOptions {
  method?: string;
  body?: unknown;
}

async function mailerliteRequest<T>(
  apiKey: string,
  path: string,
  options: MailerLiteRequestOptions = {}
): Promise<T> {
  const { method = 'GET', body } = options;

  const response = await fetch(`${MAILERLITE_API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || `MailerLite API error: ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// =============================================================================
// API Key Validation
// =============================================================================

/**
 * Test if a MailerLite API key is valid by fetching groups with limit=1
 */
export async function testApiKey(apiKey: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    await mailerliteRequest<MailerLitePaginatedResponse<MailerLiteGroup>>(
      apiKey,
      '/groups?limit=1'
    );
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid API key',
    };
  }
}

// =============================================================================
// Groups
// =============================================================================

/**
 * Fetch all subscriber groups from MailerLite
 */
export async function getGroups(apiKey: string): Promise<MailerLiteGroup[]> {
  const allGroups: MailerLiteGroup[] = [];
  let page = 1;
  const limit = 100;

  // Paginate through all groups (max 1000 per account)
  while (true) {
    const response = await mailerliteRequest<MailerLitePaginatedResponse<MailerLiteGroup>>(
      apiKey,
      `/groups?limit=${limit}&page=${page}`
    );

    allGroups.push(...response.data);

    // Check if there are more pages
    if (
      !response.meta?.last_page ||
      page >= response.meta.last_page ||
      response.data.length < limit
    ) {
      break;
    }

    page++;
  }

  return allGroups;
}

// =============================================================================
// Fields
// =============================================================================

/**
 * Fetch all subscriber fields from MailerLite (including custom fields)
 */
export async function getFields(apiKey: string): Promise<MailerLiteField[]> {
  const response = await mailerliteRequest<MailerLitePaginatedResponse<MailerLiteField>>(
    apiKey,
    '/fields?limit=100'
  );

  return response.data || [];
}

// =============================================================================
// Subscribers
// =============================================================================

/**
 * Create or update a subscriber in MailerLite
 * This is a non-destructive upsert: existing fields/groups are preserved.
 */
export async function upsertSubscriber(
  apiKey: string,
  email: string,
  fields: Record<string, string>,
  groupIds: string[]
): Promise<MailerLiteSubscriber> {
  const response = await mailerliteRequest<{ data: MailerLiteSubscriber }>(
    apiKey,
    '/subscribers',
    {
      method: 'POST',
      body: {
        email,
        fields,
        groups: groupIds,
      },
    }
  );

  return response.data;
}

// =============================================================================
// Integration Logic
// =============================================================================

/**
 * Process a form submission against a MailerLite connection.
 * Maps form fields to MailerLite fields and creates/updates subscriber.
 */
export async function processFormSubmission(
  apiKey: string,
  connection: MailerLiteConnection,
  formPayload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract email from field mappings
    const emailMapping = connection.fieldMappings.find(
      (m: MailerLiteFieldMapping) => m.mailerliteField === 'email'
    );

    if (!emailMapping) {
      return { success: false, error: 'No email field mapping configured' };
    }

    const email = String(formPayload[emailMapping.formField] || '').trim();

    if (!email || !email.includes('@')) {
      return { success: false, error: `Invalid email value: "${email}"` };
    }

    // Build MailerLite fields object from mappings (excluding email)
    const fields: Record<string, string> = {};
    for (const mapping of connection.fieldMappings) {
      if (mapping.mailerliteField !== 'email' && formPayload[mapping.formField]) {
        fields[mapping.mailerliteField] = String(formPayload[mapping.formField]);
      }
    }

    // Create/update subscriber with group assignment
    await upsertSubscriber(apiKey, email, fields, [connection.groupId]);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[MailerLite] Failed to process submission for form ${connection.formId}:`, message);
    return { success: false, error: message };
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey as validateApiKeyFromRepo } from '@/lib/repositories/apiKeyRepository';

export interface ApiKeyValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate API key from Authorization header
 * Expects: Authorization: Bearer <api_key>
 * 
 * The API key is hashed and compared against stored hashes in the api_keys table.
 * Updates last_used_at on successful validation.
 */
export async function validateApiKey(request: NextRequest): Promise<ApiKeyValidation> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Invalid Authorization format. Use: Bearer <api_key>' };
  }

  const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

  if (!apiKey) {
    return { valid: false, error: 'API key is required' };
  }

  try {
    // Validate against api_keys table
    const key = await validateApiKeyFromRepo(apiKey);

    if (!key) {
      return { valid: false, error: 'Invalid API key' };
    }

    return { valid: true };
  } catch (error) {
    console.error('API key validation error:', error);
    return { valid: false, error: 'API key validation failed. Please check your database configuration.' };
  }
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(message: string): NextResponse {
  return NextResponse.json(
    { error: message, code: 'UNAUTHORIZED' },
    { status: 401 }
  );
}

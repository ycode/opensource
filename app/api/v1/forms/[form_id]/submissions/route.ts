import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse } from '../../../auth';
import {
  getAllFormSubmissions,
  createFormSubmission,
} from '@/lib/repositories/formSubmissionRepository';
import type { FormSubmissionStatus } from '@/types';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/forms/{form_id}/submissions
 * List all submissions for a form with pagination and filtering
 *
 * Query Parameters:
 * - page: number (default: 1) - Page number
 * - per_page: number (default: 50, max: 100) - Items per page
 * - status: string - Filter by status (new, read, archived, spam)
 *
 * Response format:
 * {
 *   "submissions": [
 *     {
 *       "id": "uuid",
 *       "formId": "contact-form",
 *       "payload": { "name": "John", "email": "john@example.com" },
 *       "metadata": { "user_agent": "...", "referrer": "..." },
 *       "status": "new",
 *       "createdAt": "2026-01-29T10:30:00.000Z"
 *     }
 *   ],
 *   "pagination": {
 *     "page": 1,
 *     "perPage": 50,
 *     "total": 42
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ form_id: string }> }
) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return unauthorizedResponse(authResult.error!);
  }

  try {
    const { form_id } = await params;
    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const pageParam = searchParams.get('page');
    const perPageParam = searchParams.get('per_page');
    const statusParam = searchParams.get('status') as FormSubmissionStatus | null;

    const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
    const perPage = perPageParam
      ? Math.min(100, Math.max(1, parseInt(perPageParam, 10) || 50))
      : 50;

    // Validate status parameter if provided
    const validStatuses: FormSubmissionStatus[] = ['new', 'read', 'archived', 'spam'];
    const status = statusParam && validStatuses.includes(statusParam) ? statusParam : undefined;

    // Get all submissions for this form (with optional status filter)
    const allSubmissions = await getAllFormSubmissions(form_id, status);
    const total = allSubmissions.length;

    // Apply pagination
    const offset = (page - 1) * perPage;
    const paginatedSubmissions = allSubmissions.slice(offset, offset + perPage);

    // Transform to public API format
    const submissions = paginatedSubmissions.map(submission => ({
      id: submission.id,
      formId: submission.form_id,
      payload: submission.payload,
      metadata: submission.metadata,
      status: submission.status,
      createdAt: submission.created_at,
    }));

    return NextResponse.json({
      submissions,
      pagination: {
        page,
        perPage,
        total,
      },
    });
  } catch (error) {
    console.error('Error fetching form submissions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch submissions', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/forms/{form_id}/submissions
 * Create a new form submission
 *
 * Request body:
 * {
 *   "payload": { "name": "John", "email": "john@example.com", "message": "Hello!" },
 *   "metadata": { "page_url": "/contact" }  // optional
 * }
 *
 * Response format:
 * {
 *   "id": "uuid",
 *   "formId": "contact-form",
 *   "payload": { ... },
 *   "status": "new",
 *   "createdAt": "2026-01-29T10:30:00.000Z"
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ form_id: string }> }
) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return unauthorizedResponse(authResult.error!);
  }

  try {
    const { form_id } = await params;
    const body = await request.json();

    // Validate payload
    if (!body.payload || typeof body.payload !== 'object') {
      return NextResponse.json(
        { error: 'payload is required and must be an object', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Build metadata - include API source indicator
    const metadata = {
      ...body.metadata,
      source: 'api',
      user_agent: request.headers.get('user-agent') || undefined,
    };

    // Create the submission
    const submission = await createFormSubmission({
      form_id,
      payload: body.payload,
      metadata,
    });

    return NextResponse.json(
      {
        id: submission.id,
        formId: submission.form_id,
        payload: submission.payload,
        metadata: submission.metadata,
        status: submission.status,
        createdAt: submission.created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating form submission:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create submission', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

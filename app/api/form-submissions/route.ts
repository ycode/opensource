import { NextRequest, NextResponse } from 'next/server';
import {
  getAllFormSubmissions,
  getFormSummaries,
  createFormSubmission,
} from '@/lib/repositories/formSubmissionRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/form-submissions
 * Get all form submissions or form summaries
 *
 * Query params:
 * - form_id: Filter by form ID
 * - status: Filter by status
 * - summary: If 'true', returns form summaries instead of submissions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const formId = searchParams.get('form_id') || undefined;
    const status = searchParams.get('status') as 'new' | 'read' | 'archived' | 'spam' | undefined;
    const summary = searchParams.get('summary') === 'true';

    if (summary) {
      const summaries = await getFormSummaries();
      return noCache({ data: summaries });
    }

    const submissions = await getAllFormSubmissions(formId, status);
    return noCache({ data: submissions });
  } catch (error) {
    console.error('Error fetching form submissions:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch form submissions' },
      500
    );
  }
}

/**
 * POST /api/form-submissions
 * Create a new form submission (public endpoint for form submissions)
 *
 * Body:
 * - form_id: string (required)
 * - payload: object (required)
 * - metadata: object (optional - IP, user agent, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.form_id) {
      return NextResponse.json(
        { error: 'Missing required field: form_id' },
        { status: 400 }
      );
    }

    if (!body.payload || typeof body.payload !== 'object') {
      return NextResponse.json(
        { error: 'Missing or invalid field: payload' },
        { status: 400 }
      );
    }

    // Extract metadata from request if not provided
    const metadata = body.metadata || {
      user_agent: request.headers.get('user-agent') || undefined,
      referrer: request.headers.get('referer') || undefined,
      // Note: IP is typically handled by the proxy/edge, not available directly
    };

    const submission = await createFormSubmission({
      form_id: body.form_id,
      payload: body.payload,
      metadata,
    });

    return NextResponse.json(
      { data: submission, message: 'Form submitted successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating form submission:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit form' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse } from '../../auth';
import { getAllFormSubmissions } from '@/lib/repositories/formSubmissionRepository';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/forms/{form_id}
 * Get form details including submission counts by status
 *
 * Response format:
 * {
 *   "id": "contact-form",
 *   "submissionCount": 42,
 *   "statusCounts": {
 *     "new": 5,
 *     "read": 30,
 *     "archived": 7,
 *     "spam": 0
 *   },
 *   "latestSubmission": "2026-01-29T10:30:00.000Z"
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

    // Get all submissions for this form
    const submissions = await getAllFormSubmissions(form_id);

    if (submissions.length === 0) {
      return NextResponse.json(
        { error: 'Form not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Calculate status counts
    const statusCounts = {
      new: 0,
      read: 0,
      archived: 0,
      spam: 0,
    };

    let latestSubmission: string | null = null;

    for (const submission of submissions) {
      statusCounts[submission.status]++;
      if (!latestSubmission || submission.created_at > latestSubmission) {
        latestSubmission = submission.created_at;
      }
    }

    return NextResponse.json({
      id: form_id,
      submissionCount: submissions.length,
      statusCounts,
      latestSubmission,
    });
  } catch (error) {
    console.error('Error fetching form:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch form', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

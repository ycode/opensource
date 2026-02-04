import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse } from '../auth';
import { getFormSummaries } from '@/lib/repositories/formSubmissionRepository';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /ycode/api/v1/forms
 * List all forms (derived from form submissions)
 *
 * Response format:
 * {
 *   "forms": [
 *     {
 *       "id": "contact-form",
 *       "submissionCount": 42,
 *       "newCount": 5,
 *       "latestSubmission": "2026-01-29T10:30:00.000Z"
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return unauthorizedResponse(authResult.error!);
  }

  try {
    const summaries = await getFormSummaries();

    // Transform to public API format
    const forms = summaries.map(summary => ({
      id: summary.form_id,
      submissionCount: summary.submission_count,
      newCount: summary.new_count,
      latestSubmission: summary.latest_submission,
    }));

    return NextResponse.json({ forms });
  } catch (error) {
    console.error('Error fetching forms:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch forms', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse } from '../../../../auth';
import {
  getFormSubmissionById,
  updateFormSubmission,
  deleteFormSubmission,
} from '@/lib/repositories/formSubmissionRepository';
import type { FormSubmissionStatus } from '@/types';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/forms/{form_id}/submissions/{submission_id}
 * Get a single form submission
 *
 * Response format:
 * {
 *   "id": "uuid",
 *   "formId": "contact-form",
 *   "payload": { "name": "John", "email": "john@example.com" },
 *   "metadata": { "user_agent": "...", "referrer": "..." },
 *   "status": "new",
 *   "createdAt": "2026-01-29T10:30:00.000Z"
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ form_id: string; submission_id: string }> }
) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return unauthorizedResponse(authResult.error!);
  }

  try {
    const { form_id, submission_id } = await params;

    const submission = await getFormSubmissionById(submission_id);

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify submission belongs to the specified form
    if (submission.form_id !== form_id) {
      return NextResponse.json(
        { error: 'Submission not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: submission.id,
      formId: submission.form_id,
      payload: submission.payload,
      metadata: submission.metadata,
      status: submission.status,
      createdAt: submission.created_at,
    });
  } catch (error) {
    console.error('Error fetching form submission:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch submission', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/forms/{form_id}/submissions/{submission_id}
 * Update a form submission (status only)
 *
 * Request body:
 * {
 *   "status": "read"  // new, read, archived, spam
 * }
 *
 * Response format: Updated submission object
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ form_id: string; submission_id: string }> }
) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return unauthorizedResponse(authResult.error!);
  }

  try {
    const { form_id, submission_id } = await params;
    const body = await request.json();

    // Check if submission exists and belongs to the form
    const existingSubmission = await getFormSubmissionById(submission_id);

    if (!existingSubmission) {
      return NextResponse.json(
        { error: 'Submission not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (existingSubmission.form_id !== form_id) {
      return NextResponse.json(
        { error: 'Submission not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Validate status if provided
    const validStatuses: FormSubmissionStatus[] = ['new', 'read', 'archived', 'spam'];
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`, code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Update the submission
    const updatedSubmission = await updateFormSubmission(submission_id, {
      status: body.status,
    });

    return NextResponse.json({
      id: updatedSubmission.id,
      formId: updatedSubmission.form_id,
      payload: updatedSubmission.payload,
      metadata: updatedSubmission.metadata,
      status: updatedSubmission.status,
      createdAt: updatedSubmission.created_at,
    });
  } catch (error) {
    console.error('Error updating form submission:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update submission', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/forms/{form_id}/submissions/{submission_id}
 * Delete a form submission
 *
 * Response: 204 No Content on success
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ form_id: string; submission_id: string }> }
) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return unauthorizedResponse(authResult.error!);
  }

  try {
    const { form_id, submission_id } = await params;

    // Check if submission exists and belongs to the form
    const existingSubmission = await getFormSubmissionById(submission_id);

    if (!existingSubmission) {
      return NextResponse.json(
        { error: 'Submission not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (existingSubmission.form_id !== form_id) {
      return NextResponse.json(
        { error: 'Submission not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    await deleteFormSubmission(submission_id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting form submission:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete submission', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

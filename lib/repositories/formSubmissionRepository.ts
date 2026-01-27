import { getSupabaseAdmin } from '../supabase-server';
import type {
  FormSubmission,
  FormSummary,
  CreateFormSubmissionData,
  UpdateFormSubmissionData,
  FormSubmissionStatus,
} from '@/types';

/**
 * Form Submission Repository
 *
 * Handles CRUD operations for form submissions.
 * Uses Supabase/PostgreSQL via admin client.
 */

/**
 * Get all form submissions, optionally filtered by form_id
 */
export async function getAllFormSubmissions(
  formId?: string,
  status?: FormSubmissionStatus
): Promise<FormSubmission[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  let query = client
    .from('form_submissions')
    .select('*')
    .order('created_at', { ascending: false });

  if (formId) {
    query = query.eq('form_id', formId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch form submissions: ${error.message}`);
  }

  return data || [];
}

/**
 * Get form submission by ID
 */
export async function getFormSubmissionById(id: string): Promise<FormSubmission | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('form_submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch form submission: ${error.message}`);
  }

  return data;
}

/**
 * Get all unique forms with submission counts
 */
export async function getFormSummaries(): Promise<FormSummary[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Get all submissions grouped by form_id
  const { data, error } = await client
    .from('form_submissions')
    .select('form_id, status, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch form summaries: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Group by form_id and calculate counts
  const formMap = new Map<string, FormSummary>();

  for (const submission of data) {
    const existing = formMap.get(submission.form_id);

    if (existing) {
      existing.submission_count++;
      if (submission.status === 'new') {
        existing.new_count++;
      }
    } else {
      formMap.set(submission.form_id, {
        form_id: submission.form_id,
        submission_count: 1,
        new_count: submission.status === 'new' ? 1 : 0,
        latest_submission: submission.created_at,
      });
    }
  }

  return Array.from(formMap.values());
}

/**
 * Create a new form submission
 */
export async function createFormSubmission(
  submissionData: CreateFormSubmissionData
): Promise<FormSubmission> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('form_submissions')
    .insert({
      form_id: submissionData.form_id,
      payload: submissionData.payload,
      metadata: submissionData.metadata || null,
      status: 'new',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create form submission: ${error.message}`);
  }

  return data;
}

/**
 * Update a form submission (e.g., change status)
 */
export async function updateFormSubmission(
  id: string,
  submissionData: UpdateFormSubmissionData
): Promise<FormSubmission> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('form_submissions')
    .update(submissionData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update form submission: ${error.message}`);
  }

  return data;
}

/**
 * Delete a form submission
 */
export async function deleteFormSubmission(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await client
    .from('form_submissions')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete form submission: ${error.message}`);
  }
}

/**
 * Delete all submissions for a form
 */
export async function deleteFormSubmissionsByFormId(formId: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await client
    .from('form_submissions')
    .delete()
    .eq('form_id', formId);

  if (error) {
    throw new Error(`Failed to delete form submissions: ${error.message}`);
  }
}

/**
 * Mark all submissions for a form as read
 */
export async function markAllAsRead(formId: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await client
    .from('form_submissions')
    .update({ status: 'read' })
    .eq('form_id', formId)
    .eq('status', 'new');

  if (error) {
    throw new Error(`Failed to mark submissions as read: ${error.message}`);
  }
}

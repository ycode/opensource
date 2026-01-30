/**
 * Webhook Service
 *
 * Handles sending webhook notifications for form submissions.
 */

export interface WebhookPayload {
  event: 'form.submitted';
  form_id: string;
  submission_id: string;
  payload: Record<string, any>;
  metadata: {
    page_url?: string;
    user_agent?: string;
    referrer?: string;
    submitted_at: string;
  };
}

/**
 * Send a webhook POST request to the specified URL
 * @param url - The webhook endpoint URL
 * @param data - The payload to send
 * @returns Promise that resolves when webhook is sent successfully
 */
export async function sendWebhook(url: string, data: WebhookPayload): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}: ${response.statusText}`);
  }
}

/**
 * Send form submission webhook (fire and forget)
 * Logs errors but doesn't throw to prevent blocking the main flow
 * @param url - The webhook endpoint URL
 * @param formId - The form ID
 * @param submissionId - The submission ID
 * @param payload - The form submission data
 * @param metadata - Additional metadata about the submission
 */
export async function sendFormSubmissionWebhook(
  url: string,
  formId: string,
  submissionId: string,
  payload: Record<string, any>,
  metadata: {
    page_url?: string;
    user_agent?: string;
    referrer?: string;
  },
  submittedAt: string
): Promise<boolean> {
  try {
    await sendWebhook(url, {
      event: 'form.submitted',
      form_id: formId,
      submission_id: submissionId,
      payload,
      metadata: {
        ...metadata,
        submitted_at: submittedAt,
      },
    });
    return true;
  } catch (error) {
    console.error('Failed to send form submission webhook:', error);
    return false;
  }
}

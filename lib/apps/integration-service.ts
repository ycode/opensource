/**
 * App Integration Service
 *
 * Processes form submissions through configured app integrations.
 * Each app that has active connections for the submitted form
 * will receive the submission data.
 *
 * This runs fire-and-forget (non-blocking) so form submission
 * response is not delayed by integration processing.
 */

import { getAppSettingValue } from '@/lib/repositories/appSettingsRepository';
import { processFormSubmission } from '@/lib/apps/mailerlite';
import type { MailerLiteConnection } from '@/lib/apps/mailerlite/types';

/**
 * Process a form submission through all configured app integrations.
 * This is fire-and-forget - errors are logged but don't propagate.
 */
export async function processAppIntegrations(
  formId: string,
  submissionId: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await processMailerLiteIntegration(formId, payload);
  } catch (error) {
    console.error('[processAppIntegrations] Unexpected error:', error);
  }
}

/**
 * Process form submission for MailerLite integration
 */
async function processMailerLiteIntegration(
  formId: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    // Load MailerLite API key
    const apiKey = await getAppSettingValue<string>('mailerlite', 'api_key');
    if (!apiKey) return; // MailerLite not configured

    // Load connections
    const connections = await getAppSettingValue<MailerLiteConnection[]>(
      'mailerlite',
      'connections'
    );
    if (!connections || connections.length === 0) return;

    // Find active connections for this form
    const activeConnections = connections.filter(
      (c) => c.enabled && c.formId === formId
    );

    if (activeConnections.length === 0) return;

    console.log(
      `[MailerLite] Processing ${activeConnections.length} connection(s) for form "${formId}"`
    );

    // Process each connection in parallel
    const results = await Promise.allSettled(
      activeConnections.map((connection) =>
        processFormSubmission(apiKey, connection, payload)
      )
    );

    // Log results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const connection = activeConnections[i];

      if (result.status === 'fulfilled') {
        if (result.value.success) {
          console.log(
            `[MailerLite] Successfully processed form "${formId}" -> group "${connection.groupName}"`
          );
        } else {
          console.error(
            `[MailerLite] Failed to process form "${formId}" -> group "${connection.groupName}":`,
            result.value.error
          );
        }
      } else {
        console.error(
          `[MailerLite] Error processing form "${formId}" -> group "${connection.groupName}":`,
          result.reason
        );
      }
    }
  } catch (error) {
    console.error('[MailerLite] Integration error:', error);
  }
}

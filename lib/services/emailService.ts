/**
 * Email Service
 *
 * Handles sending email notifications for form submissions.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';

export interface EmailSettings {
  enabled: boolean;
  provider: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
}

export interface FormSubmissionEmailData {
  formId: string;
  submissionId: string;
  payload: Record<string, unknown>;
  metadata: {
    page_url?: string;
    user_agent?: string;
    referrer?: string;
    submitted_at: string;
  };
  replyTo?: string;
}

/**
 * Extract the first valid email address from form payload
 * Used to set Reply-To so recipients can reply directly to form submitters
 */
export function extractReplyToEmail(payload: Record<string, unknown>): string | undefined {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const value of Object.values(payload)) {
    if (typeof value === 'string' && emailRegex.test(value.trim())) {
      return value.trim();
    }
  }

  return undefined;
}

/**
 * Create a nodemailer transporter with the given settings
 */
function createTransporter(settings: EmailSettings): Transporter {
  const port = parseInt(settings.smtpPort, 10);

  return nodemailer.createTransport({
    host: settings.smtpHost,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPassword,
    },
  });
}

/**
 * Test SMTP connection with the given settings
 * @param settings - The SMTP settings to test
 * @returns Promise that resolves to true if connection is successful
 */
export async function testSmtpConnection(settings: EmailSettings): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter(settings);
    await transporter.verify();
    return { success: true };
  } catch (error) {
    console.error('SMTP connection test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Generate HTML email body for form submission notification
 */
function generateEmailHtml(data: FormSubmissionEmailData): string {
  const fields = Object.entries(data.payload)
    .map(
      ([key, value]) =>
        `<tr>
          <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; background-color: #f9fafb; width: 30%;">${escapeHtml(key)}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb;">${escapeHtml(String(value ?? ''))}</td>
        </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Form Submission</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); padding: 32px;">
    <h1 style="color: #111827; font-size: 24px; font-weight: 600; margin: 0 0 24px 0;">New Form Submission</h1>

    <div style="background-color: #f3f4f6; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px 0;"><strong>Form ID:</strong> ${escapeHtml(data.formId)}</p>
      <p style="margin: 0 0 8px 0;"><strong>Submitted:</strong> ${escapeHtml(new Date(data.metadata.submitted_at).toLocaleString())}</p>
      ${data.metadata.page_url ? `<p style="margin: 0;"><strong>Page:</strong> ${escapeHtml(data.metadata.page_url)}</p>` : ''}
    </div>

    <h2 style="color: #374151; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">Submitted Data</h2>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tbody>
        ${fields}
      </tbody>
    </table>

    <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      This email was sent automatically by your website's form submission system.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email body for form submission notification
 */
function generateEmailText(data: FormSubmissionEmailData): string {
  const fields = Object.entries(data.payload)
    .map(([key, value]) => `${key}: ${String(value ?? '')}`)
    .join('\n');

  return `
New Form Submission

Form ID: ${data.formId}
Submitted: ${new Date(data.metadata.submitted_at).toLocaleString()}
${data.metadata.page_url ? `Page: ${data.metadata.page_url}` : ''}

Submitted Data:
${fields}

---
This email was sent automatically by your website's form submission system.
  `.trim();
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}

/**
 * Send form submission email notification
 * This is a "fire and forget" function - it logs errors but doesn't throw
 * to prevent blocking the main form submission flow.
 *
 * @param to - Recipient email address
 * @param subject - Email subject line
 * @param data - Form submission data
 * @returns Promise that resolves to true if email was sent successfully
 */
export async function sendFormSubmissionEmail(
  to: string,
  subject: string,
  data: FormSubmissionEmailData
): Promise<boolean> {
  try {
    // Get email settings from database
    const settings = await getSettingByKey('email') as EmailSettings | null;

    if (!settings?.enabled) {
      console.log('Email notifications disabled - skipping email send');
      return false;
    }

    // Validate required settings
    if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
      console.error('Email settings incomplete - missing SMTP configuration');
      return false;
    }

    const transporter = createTransporter(settings);

    const fromAddress = settings.fromName
      ? `"${settings.fromName}" <${settings.fromEmail}>`
      : settings.fromEmail;

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: subject || `New form submission: ${data.formId}`,
      replyTo: data.replyTo,
      text: generateEmailText(data),
      html: generateEmailHtml(data),
    });

    console.log(`Form submission email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('Failed to send form submission email:', error);
    return false;
  }
}

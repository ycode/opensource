/**
 * SMTP Provider Presets
 *
 * Pre-configured SMTP settings for popular email providers.
 */

export const SMTP_PRESETS = {
  google: {
    label: 'Google',
    host: 'smtp.gmail.com',
    port: '587',
    note: 'Requires App Password if 2FA is enabled',
  },
  microsoft365: {
    label: 'Microsoft 365',
    host: 'smtp.office365.com',
    port: '587',
    note: 'Use your Microsoft 365 email and password',
  },
  mailersend: {
    label: 'MailerSend SMTP',
    host: 'smtp.mailersend.net',
    port: '587',
    note: 'Get credentials from MailerSend dashboard',
  },
  postmark: {
    label: 'Postmark SMTP',
    host: 'smtp.postmarkapp.com',
    port: '587',
    note: 'Use your Server API Token as password',
  },
  sendgrid: {
    label: 'SendGrid SMTP',
    host: 'smtp.sendgrid.net',
    port: '587',
    note: 'Username is "apikey", password is your API key',
  },
  mailgun: {
    label: 'Mailgun SMTP',
    host: 'smtp.mailgun.org',
    port: '587',
    note: 'Get credentials from Mailgun dashboard',
  },
  amazonses: {
    label: 'Amazon SES SMTP',
    host: 'email-smtp.us-east-1.amazonaws.com',
    port: '587',
    note: 'Use SMTP credentials from AWS Console (region-specific)',
  },
  other: {
    label: 'Other',
    host: '',
    port: '',
    note: 'Enter your custom SMTP settings',
  },
} as const;

export type SmtpProvider = keyof typeof SMTP_PRESETS;

export const SMTP_PROVIDER_OPTIONS = Object.entries(SMTP_PRESETS).map(([value, config]) => ({
  value: value as SmtpProvider,
  label: config.label,
}));

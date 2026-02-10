/**
 * MailerLite Types
 *
 * TypeScript interfaces for the MailerLite API (v2 / connect.mailerlite.com).
 */

// =============================================================================
// API Responses
// =============================================================================

export interface MailerLiteGroup {
  id: string;
  name: string;
  active_count: number;
  sent_count: number;
  opens_count: number;
  open_rate: { float: number; string: string };
  clicks_count: number;
  click_rate: { float: number; string: string };
  unsubscribed_count: number;
  unconfirmed_count: number;
  bounced_count: number;
  junk_count: number;
  created_at: string;
}

export interface MailerLiteField {
  id: string;
  name: string;
  key: string;
  type: string;
}

export interface MailerLiteSubscriber {
  id: string;
  email: string;
  status: string;
  source: string;
  fields: Record<string, string | null>;
  groups: MailerLiteGroup[];
  created_at: string;
  updated_at: string;
}

export interface MailerLitePaginatedResponse<T> {
  data: T[];
  meta: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
    path?: string;
    next_cursor?: string;
    prev_cursor?: string;
  };
}

// =============================================================================
// Connection Configuration (stored in app_settings)
// =============================================================================

export interface MailerLiteFieldMapping {
  /** The form field key (from Ycode form payload) */
  formField: string;
  /** The MailerLite subscriber field key */
  mailerliteField: string;
}

export interface MailerLiteConnection {
  id: string;
  formId: string;
  groupId: string;
  groupName: string;
  fieldMappings: MailerLiteFieldMapping[];
  enabled: boolean;
}

// =============================================================================
// Standard MailerLite subscriber fields available for mapping
// =============================================================================

export const MAILERLITE_SUBSCRIBER_FIELDS = [
  { key: 'email', label: 'Email', required: true },
  { key: 'name', label: 'Name', required: false },
  { key: 'last_name', label: 'Last Name', required: false },
  { key: 'company', label: 'Company', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'country', label: 'Country', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'state', label: 'State', required: false },
  { key: 'z_i_p', label: 'Zip', required: false },
] as const;

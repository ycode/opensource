/**
 * App Registry
 *
 * Central registry of all available app integrations.
 * Contributors can add new apps by:
 * 1. Adding an AppDefinition here
 * 2. Creating the app module under lib/apps/<app-id>/
 * 3. Adding a logo.svg in lib/apps/<app-id>/logo.svg
 * 4. Creating proxy API routes under app/ycode/api/apps/<app-id>/
 */

import type { StaticImageData } from 'next/image';

import mailerliteLogo from './mailerlite/logo.svg';
import mailchimpLogo from './mailchimp/logo.svg';
import zapierLogo from './zapier/logo.svg';
import makeLogo from './make/logo.svg';

// =============================================================================
// Types
// =============================================================================

export type AppCategory = 'popular' | 'marketing' | 'automation' | 'analytics' | 'email' | 'other';

export const APP_CATEGORIES: { value: AppCategory; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'automation', label: 'Automation' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
];

export interface AppDefinition {
  /** Unique identifier (kebab-case), used as app_id in database */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Static import of the app logo (place logo.svg in lib/apps/<app-id>/) */
  logo: StaticImageData;
  /** Categories for grouping (an app can belong to multiple categories) */
  categories: AppCategory[];
  /** Whether this app is fully implemented or just a placeholder */
  implemented: boolean;
}

// =============================================================================
// Registered Apps
// =============================================================================

export const apps: AppDefinition[] = [
  {
    id: 'mailerlite',
    name: 'MailerLite',
    description: 'Send form submissions to MailerLite subscriber groups with field mapping.',
    logo: mailerliteLogo,
    categories: ['popular', 'marketing'],
    implemented: true,
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Sync form submissions with Mailchimp audiences and manage email campaigns.',
    logo: mailchimpLogo,
    categories: ['popular', 'marketing'],
    implemented: false,
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect your website to 5,000+ apps with automated workflows.',
    logo: zapierLogo,
    categories: ['popular', 'automation'],
    implemented: false,
  },
  {
    id: 'make',
    name: 'Make',
    description: 'Build powerful automations with a visual workflow builder.',
    logo: makeLogo,
    categories: ['popular', 'automation'],
    implemented: false,
  },
];

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get all registered apps
 */
export function getAllApps(): AppDefinition[] {
  return apps;
}

/**
 * Get a specific app by ID
 */
export function getAppById(id: string): AppDefinition | undefined {
  return apps.find((app) => app.id === id);
}

/**
 * Get apps filtered by category
 */
export function getAppsByCategory(category: AppCategory): AppDefinition[] {
  return apps.filter((app) => app.categories.includes(category));
}

/**
 * Get all unique categories that have at least one app
 */
export function getActiveCategories(): AppCategory[] {
  const categorySet = new Set<AppCategory>();
  for (const app of apps) {
    for (const cat of app.categories) {
      categorySet.add(cat);
    }
  }
  // Return in defined order
  return APP_CATEGORIES
    .map((c) => c.value)
    .filter((c) => categorySet.has(c));
}

/**
 * App Registry
 *
 * Central registry of all available app integrations.
 * Contributors can add new apps by:
 * 1. Adding an AppDefinition here
 * 2. Creating the app module under lib/apps/<app-id>/
 * 3. Creating the settings page under app/ycode/integrations/apps/<app-id>/
 * 4. Creating proxy API routes under app/ycode/api/apps/<app-id>/
 */

// =============================================================================
// Types
// =============================================================================

export type AppCategory = 'email' | 'analytics' | 'marketing' | 'automation' | 'other';

export interface AppDefinition {
  /** Unique identifier (kebab-case), used as app_id in database */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Icon name from the Icon component */
  icon: string;
  /** Category for grouping */
  category: AppCategory;
  /** Route to the app's settings page */
  settingsPath: string;
}

// =============================================================================
// Registered Apps
// =============================================================================

export const apps: AppDefinition[] = [
  {
    id: 'mailerlite',
    name: 'MailerLite',
    description: 'Send form submissions to MailerLite subscriber groups with field mapping.',
    icon: 'email',
    category: 'email',
    settingsPath: '/ycode/integrations/apps/mailerlite',
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

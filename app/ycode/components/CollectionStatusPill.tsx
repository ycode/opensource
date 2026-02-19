'use client';

type StatusTheme = 'green' | 'gray' | 'yellow' | 'blue';

interface StatusData {
  label: string;
  theme: StatusTheme;
}

const THEME_CLASSES: Record<StatusTheme, string> = {
  green: 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300/70',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400/90',
  gray: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  yellow: 'bg-amber-500/10 text-amber-600 dark:text-amber-400/75',
};

/** Status value shape returned by the backend (JSON in the status field) */
export interface ItemStatusValue {
  is_publishable: boolean;
  is_published: boolean;
  is_modified: boolean;
}

/** Parse the status JSON value from an item's values map */
export function parseStatusValue(value: unknown): ItemStatusValue | null {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (typeof parsed === 'object' && parsed !== null && 'is_publishable' in parsed) {
      return parsed as ItemStatusValue;
    }
  } catch { /* ignore parse errors */ }
  return null;
}

/** Compute display status from the backend status value */
function getStatus(status: ItemStatusValue): StatusData {
  if (status.is_published && status.is_publishable) {
    return status.is_modified
      ? { label: 'Published · Edited', theme: 'blue' }
      : { label: 'Published', theme: 'green' };
  }
  return status.is_publishable
    ? { label: 'Staged for publish', theme: 'gray' }
    : { label: 'Draft', theme: 'yellow' };
}

interface CollectionStatusPillProps {
  statusValue: ItemStatusValue | null;
  className?: string;
}

export function CollectionStatusPill({ statusValue, className = '' }: CollectionStatusPillProps) {
  if (!statusValue) return null;

  const status = getStatus(statusValue);

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${THEME_CLASSES[status.theme]} ${className}`}
    >
      {status.label}
    </span>
  );
}

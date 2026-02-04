/**
 * Date formatting utilities with timezone support
 */

import type { CollectionField } from '@/types';

/**
 * Format a UTC date in the specified timezone
 * Uses Intl.DateTimeFormat for timezone conversion
 */
export function formatDateInTimezone(
  date: string | Date | null | undefined,
  timezone: string = 'UTC',
  format: 'display' | 'datetime-local' | 'date' = 'display'
): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';

  try {
    if (format === 'display') {
      // Format for display: "Nov 12 2025, 09:38"
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(dateObj);
    }

    if (format === 'datetime-local') {
      // Format for <input type="datetime-local">: "2025-11-12T09:38"
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(dateObj);

      const get = (type: string) => parts.find(p => p.type === type)?.value || '';
      return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
    }

    if (format === 'date') {
      // Format for <input type="date">: "2025-11-12"
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(dateObj);

      const get = (type: string) => parts.find(p => p.type === type)?.value || '';
      return `${get('year')}-${get('month')}-${get('day')}`;
    }
  } catch {
    // Fallback if timezone is invalid
    return '';
  }

  return '';
}

/**
 * Convert a local datetime string (in the given timezone) to UTC ISO string for storage
 */
export function localDatetimeToUTC(
  localDatetime: string,
  timezone: string = 'UTC'
): string {
  if (!localDatetime) return '';

  try {
    // Parse the local datetime string
    // Handle both "2025-11-12T09:38" and "2025-11-12" formats
    const hasTime = localDatetime.includes('T');
    const dateStr = hasTime ? localDatetime : `${localDatetime}T00:00`;

    // Create a formatter that can parse dates in the given timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Get the offset for this timezone at this specific date
    // We do this by formatting a known UTC date and comparing
    const [datePart, timePart] = dateStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);

    // Create a date assuming UTC, then adjust
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

    // Get timezone offset by comparing formatted local time with UTC
    const localParts = formatter.formatToParts(utcDate);
    const get = (type: string) => Number(localParts.find(p => p.type === type)?.value || 0);

    const localYear = get('year');
    const localMonth = get('month');
    const localDay = get('day');
    const localHour = get('hour');
    const localMinute = get('minute');

    // Calculate offset in minutes
    const utcMinutes = utcDate.getUTCHours() * 60 + utcDate.getUTCMinutes();
    const localDate = new Date(Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute, 0));
    const localMinutesOfDay = localDate.getUTCHours() * 60 + localDate.getUTCMinutes();

    let offsetMinutes = localMinutesOfDay - utcMinutes;

    // Handle day boundary crossing
    const dayDiff = localDate.getUTCDate() - utcDate.getUTCDate();
    if (dayDiff !== 0) {
      offsetMinutes += dayDiff * 24 * 60;
    }

    // Now create the actual date by subtracting the offset
    const targetDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    targetDate.setUTCMinutes(targetDate.getUTCMinutes() - offsetMinutes);

    return targetDate.toISOString();
  } catch {
    return '';
  }
}

/**
 * Format date field values in collection item data
 * Converts UTC ISO strings to formatted timezone-aware display strings
 */
export function formatDateFieldsInItemValues(
  itemValues: Record<string, string>,
  collectionFields: CollectionField[],
  timezone: string = 'UTC'
): Record<string, string> {
  // Build a set of date field IDs for quick lookup
  const dateFieldIds = new Set(
    collectionFields.filter(f => f.type === 'date').map(f => f.id)
  );

  // If no date fields, return original values
  if (dateFieldIds.size === 0) {
    return itemValues;
  }

  // Format date values
  const formattedValues = { ...itemValues };
  for (const fieldId of dateFieldIds) {
    const value = itemValues[fieldId];
    if (value) {
      formattedValues[fieldId] = formatDateInTimezone(value, timezone, 'display');
    }
  }

  return formattedValues;
}

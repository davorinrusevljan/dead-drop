/**
 * Locale-aware date formatting utilities.
 *
 * Uses the browser's locale chain (navigator.languages) to format dates
 * in the user's preferred locale. Falls back to a verbose, unambiguous
 * format (e.g. "11 May 2026") if locale detection fails.
 */

function getLocale(): string | string[] {
  if (typeof navigator !== 'undefined' && navigator.languages?.length) {
    return navigator.languages;
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en-US';
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

const DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

/**
 * Format a date string (ISO 8601) as a locale-aware date.
 * e.g. "11 May 2026", "11. svi 2026."
 */
export function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat(getLocale(), DATE_OPTIONS).format(new Date(isoString));
}

/**
 * Format a date string (ISO 8601) as a locale-aware date + time.
 * e.g. "11 May 2026, 14:30:00", "11. svi 2026. u 14:30:00"
 */
export function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat(getLocale(), DATETIME_OPTIONS).format(new Date(isoString));
}

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for 'yyyy-MM-dd' calendar-date strings (no time zone component). */
export function isCalendarDateString(value: string): boolean {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(year, month - 1, day);
  return probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day;
}

/**
 * Parses a 'yyyy-MM-dd' calendar date as local midnight. Never shifts the
 * day across time zones the way Date.parse of a bare date string (UTC) does.
 */
export function toCalendarDate(value: string): Date | null {
  if (!isCalendarDateString(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Formats a Date back to its local 'yyyy-MM-dd' calendar date (no UTC shift). */
export function toCalendarDateString(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

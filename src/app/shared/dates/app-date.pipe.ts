import { DatePipe } from '@angular/common';
import { inject, Pipe, PipeTransform } from '@angular/core';
import { TRANSLATION } from '../i18n/translation.port';
import { isCalendarDateString, toCalendarDate } from './calendar-date';

type Preset = 'short' | 'medium' | 'long';

const PRESETS: Record<Preset, string> = {
  short: 'shortDate',
  medium: 'mediumDate',
  long: 'longDate',
};

/**
 * Locale-aware date formatting:
 * - 'yyyy-MM-dd' calendar strings render as calendar dates (no UTC drift)
 * - Date instances / full ISO instants render in the viewer's time zone
 * - the locale follows the live TranslationPort value, not just LOCALE_ID
 */
@Pipe({
  name: 'appDateFormat',
  // Re-evaluates on locale change (signal read inside transform).
  pure: false,
})
export class AppDatePipe implements PipeTransform {
  private readonly translation = inject(TRANSLATION);
  private cachedLocale: string | null = null;
  private datePipe: DatePipe | null = null;

  transform(value: string | Date | null | undefined, preset: Preset = 'medium'): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const calendarDate =
      typeof value === 'string' && isCalendarDateString(value) ? toCalendarDate(value) : null;
    const resolved = calendarDate ?? value;

    return this.pipe().transform(resolved, PRESETS[preset] ?? preset) ?? '';
  }

  private pipe(): DatePipe {
    const locale = this.translation.locale();
    if (this.cachedLocale !== locale || !this.datePipe) {
      this.cachedLocale = locale;
      this.datePipe = new DatePipe(locale);
    }
    return this.datePipe;
  }
}

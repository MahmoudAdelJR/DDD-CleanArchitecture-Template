import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TRANSLATION, TranslationPort } from '../i18n/translation.port';
import { AppDatePipe } from './app-date.pipe';

function port(locale: string): TranslationPort {
  return {
    locale: () => locale,
    supportedLocales: () => [locale],
    translate: key => key,
    setLocale: () => {}
  };
}

describe('AppDatePipe', () => {
  function create(locale = 'en'): AppDatePipe {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: TRANSLATION, useFactory: () => port(locale) },
        AppDatePipe
      ]
    });
    return TestBed.inject(AppDatePipe);
  }

  it('renders calendar-date strings on the same calendar day', () => {
    const pipe = create();

    expect(pipe.transform('2024-02-29')).toBe('Feb 29, 2024');
    expect(pipe.transform('2024-01-01')).toBe('Jan 1, 2024');
  });

  it('supports presets', () => {
    const pipe = create();

    expect(pipe.transform('2024-02-29', 'short')).toBe('2/29/24');
    expect(pipe.transform('2024-02-29', 'long')).toBe('February 29, 2024');
  });

  it('returns empty strings for missing values', () => {
    const pipe = create();

    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('formats Date instances without shifting the calendar day', () => {
    const pipe = create();
    const localEvening = new Date(2024, 9, 31, 23, 45);

    expect(pipe.transform(localEvening)).toBe('Oct 31, 2024');
  });
});

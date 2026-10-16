import { InjectionToken } from '@angular/core';

/**
 * Business-agnostic translation contract. The platform provides the adapter
 * (core/i18n/LocaleService); shared UI and features depend only on this port,
 * keeping the shared layer free of core imports.
 */
export interface TranslationPort {
  /** Current locale, e.g. 'en'. Signal-friendly: returns the live value. */
  locale(): string;
  supportedLocales(): readonly string[];
  /**
   * Resolves `key` in the current locale, interpolating `{param}` tokens.
   * Falls back to the default locale catalog, then to `fallback`, then to the key.
   */
  translate(key: string, params?: Record<string, string | number>, fallback?: string): string;
  setLocale(locale: string): void;
}

export const TRANSLATION = new InjectionToken<TranslationPort>('shared.TranslationPort');

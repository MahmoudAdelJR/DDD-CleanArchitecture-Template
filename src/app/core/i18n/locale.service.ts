import { Injectable, inject, signal } from '@angular/core';
import { TranslationPort } from '../../shared/i18n/translation.port';
import { APP_CONFIG } from '../config/app-config';
import { STORAGE } from '../storage/storage.port';
import { CATALOGS } from './locale-catalog';

export const LANGUAGE_STORAGE_KEY = 'app.language';

const RTL_LANGUAGE_PREFIXES = ['ar', 'he', 'fa', 'ur'];

/**
 * Single source of truth for the active locale. Drives translation lookups,
 * the document lang/dir attributes, persistence, and (through provideCoreI18n)
 * LOCALE_ID and the Accept-Language request header.
 */
@Injectable()
export class LocaleService implements TranslationPort {
  private readonly config = inject(APP_CONFIG);
  private readonly storage = inject(STORAGE);

  private readonly _locale = signal<string>(this.resolveInitialLocale());

  readonly locale = this._locale.asReadonly();

  constructor() {
    this.syncDocument();
  }

  supportedLocales(): readonly string[] {
    return this.config.supportedLocales;
  }

  translate(
    key: string,
    params?: Record<string, string | number>,
    fallback?: string
  ): string {
    const entry =
      this.lookup(this._locale(), key) ?? this.lookup(this.config.defaultLocale, key);

    const template = entry ?? fallback ?? key;
    return params ? interpolate(template, params) : template;
  }

  setLocale(locale: string): void {
    if (!this.config.supportedLocales.includes(locale)) {
      return;
    }

    this._locale.set(locale);
    this.storage.setItem(LANGUAGE_STORAGE_KEY, locale);
    this.syncDocument();
  }

  private resolveInitialLocale(): string {
    const stored = this.storage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && this.config.supportedLocales.includes(stored)) {
      return stored;
    }

    return this.config.defaultLocale;
  }

  private lookup(locale: string, key: string): string | undefined {
    return CATALOGS[locale]?.[key];
  }

  private syncDocument(): void {
    const locale = this._locale();
    document.documentElement.lang = locale;

    const prefix = locale.split(/[-_]/)[0]!;
    document.documentElement.dir = RTL_LANGUAGE_PREFIXES.includes(prefix) ? 'rtl' : 'ltr';
  }
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match
  );
}

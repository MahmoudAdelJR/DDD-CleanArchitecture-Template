import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { STORAGE } from '../storage/storage.port';
import { MemoryStorage } from '../testing/memory-storage';
import { LANGUAGE_STORAGE_KEY, LocaleService } from './locale.service';

const CONFIG: AppConfig = {
  apiBaseUrl: '/api',
  trustedOrigins: [],
  supportedLocales: ['en', 'fr'],
  defaultLocale: 'en'
};

describe('LocaleService', () => {
  let storage: MemoryStorage;

  function setup(stored?: string): LocaleService {
    TestBed.configureTestingModule({
      providers: [
        LocaleService,
        provideZonelessChangeDetection(),
        { provide: APP_CONFIG, useValue: CONFIG },
        { provide: STORAGE, useClass: MemoryStorage }
      ]
    });

    storage = TestBed.inject(STORAGE) as MemoryStorage;
    if (stored) {
      storage.setItem(LANGUAGE_STORAGE_KEY, stored);
    }

    return TestBed.inject(LocaleService);
  }

  afterEach(() => {
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('uses the persisted supported locale at startup', () => {
    const service = setup('fr');

    expect(service.locale()).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('ignores persisted locales that are not supported', () => {
    const service = setup('de');
    expect(service.locale()).toBe('en');
  });

  it('persists and applies locale changes', () => {
    const service = setup();

    service.setLocale('fr');

    expect(service.locale()).toBe('fr');
    expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('rejects unsupported locales', () => {
    const service = setup();

    service.setLocale('xx');

    expect(service.locale()).toBe('en');
  });

  it('translates with params, fallbacks, and default-locale lookup', () => {
    const service = setup();

    expect(service.translate('customers.pagination', { page: 2, total: 5 })).toBe('Page 2 of 5');
    expect(service.translate('validation.required', { label: 'Email' })).toBe('Email is required.');
    expect(service.translate('missing.key', undefined, 'safe fallback')).toBe('safe fallback');
    expect(service.translate('missing.key')).toBe('missing.key');
  });

  it('falls back to the default catalog for keys missing in the active locale', () => {
    const service = setup();
    service.setLocale('fr');

    expect(service.translate('nav.customers')).toBe('Clients');
  });
});

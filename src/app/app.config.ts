import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  inject,
  provideAppInitializer
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { languageInterceptor } from './core/interceptors/language.interceptor';
import { DEFAULT_APP_CONFIG, provideAppConfig } from './core/config/app-config';
import { STORAGE } from './core/storage/storage.port';
import { BrowserStorageAdapter } from './core/storage/browser-storage.adapter';
import { AuthSessionService } from './core/services/auth-session.service';
import { provideAuthDataAccess } from './features/auth/data-access/auth-data-access.providers';
import { provideCoreI18n } from './core/i18n/provide-i18n';
import { LocaleService } from './core/i18n/locale.service';

/**
 * Interceptor pipeline (outermost first):
 *   loading -> error -> language -> auth -> backend
 * The innermost auth interceptor refreshes and retries on 401, so the error
 * interceptor only notifies for failures that survive the retry.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),

    // Runtime configuration. Override per deployment (e.g. from /config.json).
    provideAppConfig(DEFAULT_APP_CONFIG),

    { provide: STORAGE, useClass: BrowserStorageAdapter },

    // Platform i18n: LocaleService adapts the shared TranslationPort,
    // LOCALE_ID follows the persisted preference at bootstrap.
    ...provideCoreI18n(),

    // Platform-side auth adapters (swap with real HTTP/identity providers).
    ...provideAuthDataAccess(),

    provideAppInitializer(() => {
      // Construct now so document lang/dir sync and translation lookups are
      // ready before the first component renders.
      inject(LocaleService);
    }),

    provideAppInitializer(async () => {
      await inject(AuthSessionService).restoreSession();
    }),

    provideHttpClient(
      withFetch(),
      withInterceptors([loadingInterceptor, errorInterceptor, languageInterceptor, authInterceptor])
    )
  ]
};

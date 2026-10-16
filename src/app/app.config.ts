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

    // Platform-side auth adapters (swap with real HTTP/identity providers).
    ...provideAuthDataAccess(),

    provideAppInitializer(async () => {
      await inject(AuthSessionService).restoreSession();
    }),

    provideHttpClient(
      withFetch(),
      withInterceptors([loadingInterceptor, errorInterceptor, languageInterceptor, authInterceptor])
    )
  ]
};

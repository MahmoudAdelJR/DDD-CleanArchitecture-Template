import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { languageInterceptor } from './core/interceptors/language.interceptor';
import { AppConfig, provideAppConfig } from './core/config/app-config';
import { STORAGE } from './core/storage/storage.port';
import { BrowserStorageAdapter } from './core/storage/browser-storage.adapter';
import { AuthSessionService } from './core/services/auth-session.service';
import { provideAuthDataAccess } from './features/auth/data-access/auth-data-access.providers';
import { provideCoreI18n } from './core/i18n/provide-i18n';
import { LocaleService } from './core/i18n/locale.service';
import { LOGGER } from './shared/observability/logger.port';
import { StructuredConsoleLogger } from './core/logging/structured-console.logger';
import { AppErrorHandler } from './core/logging/app-error.handler';
import { TELEMETRY } from './core/telemetry/telemetry.port';
import { NoopTelemetryAdapter } from './core/telemetry/noop-telemetry.adapter';
import {
  CORRELATION_ID,
  correlationInterceptor,
  generateCorrelationId,
} from './core/telemetry/correlation.interceptor';
import { mockApiInterceptor } from './dev/mock-api.interceptor';
import { ErrorHandler } from '@angular/core';

/**
 * Interceptor pipeline (outermost first):
 *   loading -> error -> language -> correlation -> auth -> mock -> backend
 *
 * The innermost auth interceptor refreshes and retries on 401, so the error
 * interceptor only notifies/logs failures that survive the retry.
 * The dev mock interceptor answers trusted requests when AppConfig.mockApi
 * is true and otherwise passes everything through to the real backend.
 */
export function createAppConfig(runtimeConfig: AppConfig): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideZonelessChangeDetection(),
      provideRouter(routes),

      provideAppConfig(runtimeConfig),

      { provide: STORAGE, useClass: BrowserStorageAdapter },

      // Platform i18n: LocaleService adapts the shared TranslationPort,
      // LOCALE_ID follows the persisted preference at bootstrap.
      ...provideCoreI18n(),

      // Platform-side auth adapters (swap with real HTTP/identity providers).
      ...provideAuthDataAccess(),

      // Observability: redacted structured logs, replaceable telemetry sink,
      // and a per-session correlation id propagated to trusted API requests.
      { provide: LOGGER, useClass: StructuredConsoleLogger },
      { provide: TELEMETRY, useClass: NoopTelemetryAdapter },
      { provide: CORRELATION_ID, useFactory: generateCorrelationId },
      { provide: ErrorHandler, useClass: AppErrorHandler },

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
        withInterceptors([
          loadingInterceptor,
          errorInterceptor,
          languageInterceptor,
          correlationInterceptor,
          authInterceptor,
          mockApiInterceptor,
        ]),
      ),
    ],
  };
}

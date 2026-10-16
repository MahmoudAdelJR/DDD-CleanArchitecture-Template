import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AppConfig, APP_CONFIG, isTrustedApiUrl } from '../config/app-config';
import { STORAGE } from '../storage/storage.port';

export const LANGUAGE_STORAGE_KEY = 'app.language';

/**
 * Adds Accept-Language only to trusted API origins. Untrusted third-party
 * requests keep a simple CORS shape.
 */
export const languageInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(APP_CONFIG);
  const storage = inject(STORAGE);

  if (!isTrustedApiUrl(request.url, config)) {
    return next(request);
  }

  const language = resolveLanguage(storage.getItem(LANGUAGE_STORAGE_KEY), config);

  return next(
    request.clone({
      setHeaders: { 'Accept-Language': language }
    })
  );
};

function resolveLanguage(stored: string | null, config: AppConfig): string {
  if (stored && config.supportedLocales.includes(stored)) {
    return stored;
  }
  return config.defaultLocale;
}

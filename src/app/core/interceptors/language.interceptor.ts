import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { APP_CONFIG, isTrustedApiUrl } from '../config/app-config';
import { LocaleService } from '../i18n/locale.service';

/**
 * Adds Accept-Language only to trusted API origins, using the single
 * LocaleService as the source of truth (already validated + persisted).
 */
export const languageInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(APP_CONFIG);

  if (!isTrustedApiUrl(request.url, config)) {
    return next(request);
  }

  const locale = inject(LocaleService).locale();

  return next(
    request.clone({
      setHeaders: { 'Accept-Language': locale },
    }),
  );
};

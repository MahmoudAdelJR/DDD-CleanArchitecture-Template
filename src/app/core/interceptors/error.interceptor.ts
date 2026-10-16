// core/interceptors/error.interceptor.ts

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { normalizeApiError } from '../http/api-error';
import { SUPPRESS_GLOBAL_ERROR } from '../http/http-context';
import { TRANSLATION } from '../../shared/i18n/translation.port';
import { LOGGER } from '../../shared/observability/logger.port';
import { TELEMETRY } from '../telemetry/telemetry.port';
import { NotificationService } from '../services/notification.service';

/**
 * Normalizes every failed HTTP response into an ApiError, logs it (structured,
 * redacted) and reports 5xx failures to telemetry, raises a safe user-facing
 * notification (unless suppressed per request), and rethrows the ApiError so
 * feature code can react to status, code, or field validation.
 *
 * Runs outside the auth interceptor in the pipeline, so a 401 reaching this
 * point already survived (or failed) the refresh-and-retry attempt.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const notification = inject(NotificationService);
  const translation = inject(TRANSLATION, { optional: true });
  const logger = inject(LOGGER, { optional: true });
  const telemetry = inject(TELEMETRY, { optional: true });

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      const apiError = normalizeApiError(
        error,
        translation
          ? (key, params, fallback) => translation.translate(key, params, fallback)
          : undefined,
      );

      logger?.warn('http request failed', {
        source: 'error-interceptor',
        method: request.method,
        url: request.url,
        status: apiError.status,
        code: apiError.code,
        correlationId: apiError.correlationId,
      });

      if (apiError.status >= 500) {
        telemetry?.reportError(apiError, {
          kind: 'api-error',
          status: apiError.status,
          correlationId: apiError.correlationId,
        });
      }

      if (!request.context.get(SUPPRESS_GLOBAL_ERROR)) {
        notification.error(apiError.message, apiError.code ?? undefined);
      }

      return throwError(() => apiError);
    }),
  );
};

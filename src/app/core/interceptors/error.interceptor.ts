// core/interceptors/error.interceptor.ts

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { normalizeApiError } from '../http/api-error';
import { SUPPRESS_GLOBAL_ERROR } from '../http/http-context';
import { NotificationService } from '../services/notification.service';

/**
 * Normalizes every failed HTTP response into an ApiError, raises a safe
 * user-facing notification (unless suppressed per request), and rethrows the
 * ApiError so feature code can react to status, code, or field validation.
 *
 * Runs outside the auth interceptor in the pipeline, so a 401 reaching this
 * point already survived (or failed) the refresh-and-retry attempt.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const notification = inject(NotificationService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      const apiError = normalizeApiError(error);

      if (!request.context.get(SUPPRESS_GLOBAL_ERROR)) {
        notification.error(apiError.message, apiError.code ?? undefined);
      }

      return throwError(() => apiError);
    })
  );
};

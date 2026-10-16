import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { APP_CONFIG, isTrustedApiUrl } from '../config/app-config';
import { SKIP_AUTH } from '../http/http-context';
import { AuthSessionService } from '../services/auth-session.service';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authSession = inject(AuthSessionService);
  const config = inject(APP_CONFIG);
  const router = inject(Router);

  const skipAuth = request.context.get(SKIP_AUTH);
  const trusted = isTrustedApiUrl(request.url, config);

  // Credentials are attached only to trusted origins unless explicitly skipped.
  const token = skipAuth || !trusted ? null : authSession.accessToken();
  const outgoing = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  if (skipAuth || !trusted) {
    return next(outgoing);
  }

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      const unauthorized = error instanceof HttpErrorResponse && error.status === 401;
      if (!unauthorized) {
        return throwError(() => error);
      }

      return from(authSession.refreshOnce()).pipe(
        switchMap((refreshed) => {
          if (refreshed && authSession.accessToken()) {
            return next(
              request.clone({
                setHeaders: { Authorization: `Bearer ${authSession.accessToken()}` },
              }),
            );
          }

          void router.navigate(['/login'], {
            queryParams: { returnUrl: router.url === '/' ? undefined : router.url },
          });
          return throwError(() => error);
        }),
      );
    }),
  );
};

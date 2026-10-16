import { HttpInterceptorFn } from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';
import { APP_CONFIG, isTrustedApiUrl } from '../config/app-config';

export const CORRELATION_ID = new InjectionToken<string>('core.CorrelationId');

export function generateCorrelationId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) {
    return uuid;
  }

  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Tags trusted API requests with a per-application-session correlation id so
 * client, gateway, and backend logs can be stitched together. Third-party
 * requests stay untouched to keep their CORS shape simple.
 */
export const correlationInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(APP_CONFIG);

  if (!isTrustedApiUrl(request.url, config) || request.headers.has('x-correlation-id')) {
    return next(request);
  }

  const correlationId = inject(CORRELATION_ID);

  return next(
    request.clone({
      setHeaders: { 'x-correlation-id': correlationId },
    }),
  );
};

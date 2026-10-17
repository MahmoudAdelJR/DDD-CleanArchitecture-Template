import { Provider } from '@angular/core';
import { SESSION_REFRESH_PORT } from '../../../core/auth/session-refresh.port';
import { AUTHENTICATION_PORT } from './authentication.port';
import { HttpAuthenticationAdapter } from './http-authentication.adapter';

/**
 * Production auth adapters: sign-in and refresh hit the real identity API and
 * share one adapter instance. This file replaces
 * `auth-data-access.providers.ts` in production builds via angular.json
 * `fileReplacements`, keeping the fake adapter out of the release bundle.
 */
export function provideAuthDataAccess(): Provider[] {
  return [
    HttpAuthenticationAdapter,
    { provide: AUTHENTICATION_PORT, useExisting: HttpAuthenticationAdapter },
    { provide: SESSION_REFRESH_PORT, useExisting: HttpAuthenticationAdapter },
  ];
}

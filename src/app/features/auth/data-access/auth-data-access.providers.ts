import { Provider } from '@angular/core';
import { SESSION_REFRESH_PORT } from '../../../core/auth/session-refresh.port';
import { AUTHENTICATION_PORT } from './authentication.port';
import { FakeAuthenticationAdapter } from './fake-authentication.adapter';

/**
 * Root-level auth adapters (development/demo default). Both ports resolve to
 * the same instance so the fake sign-in and fake refresh stay consistent.
 *
 * Production builds replace this file with
 * `auth-data-access.providers.production.ts` (real HTTP identity adapter) via
 * angular.json `fileReplacements`, so the demo credentials below never ship.
 */
export function provideAuthDataAccess(): Provider[] {
  return [
    FakeAuthenticationAdapter,
    { provide: AUTHENTICATION_PORT, useExisting: FakeAuthenticationAdapter },
    { provide: SESSION_REFRESH_PORT, useExisting: FakeAuthenticationAdapter },
  ];
}

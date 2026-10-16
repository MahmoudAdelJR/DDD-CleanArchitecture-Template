import { Provider } from '@angular/core';
import { SESSION_REFRESH_PORT } from '../../../core/auth/session-refresh.port';
import { AUTHENTICATION_PORT } from './authentication.port';
import { FakeAuthenticationAdapter } from './fake-authentication.adapter';

/**
 * Root-level auth adapters. Both ports resolve to the same instance so the
 * fake sign-in and fake refresh stay consistent. Swap this function's
 * contents for a real identity API adapter without touching the slices.
 */
export function provideAuthDataAccess(): Provider[] {
  return [
    FakeAuthenticationAdapter,
    { provide: AUTHENTICATION_PORT, useExisting: FakeAuthenticationAdapter },
    { provide: SESSION_REFRESH_PORT, useExisting: FakeAuthenticationAdapter }
  ];
}

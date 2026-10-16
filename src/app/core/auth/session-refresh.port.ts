import { InjectionToken } from '@angular/core';
import type { SessionPayload } from './session.model';

/**
 * Port for exchanging a refresh token for a new session. The auth feature
 * ships the adapter; the platform (session service + 401 handling) depends
 * only on this contract.
 */
export interface SessionRefreshPort {
  refresh(refreshToken: string): Promise<SessionPayload>;
}

export const SESSION_REFRESH_PORT = new InjectionToken<SessionRefreshPort>(
  'core.SessionRefreshPort',
);

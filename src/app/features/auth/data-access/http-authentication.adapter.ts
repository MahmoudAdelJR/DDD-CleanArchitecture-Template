import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AuthUser, SessionPayload } from '../../../core/auth/session.model';
import { SessionRefreshPort } from '../../../core/auth/session-refresh.port';
import { APP_CONFIG } from '../../../core/config/app-config';
import { isApiError } from '../../../core/http/api-error';
import { SKIP_AUTH, SKIP_LOADING, SUPPRESS_GLOBAL_ERROR } from '../../../core/http/http-context';
import type { AuthenticatedSession, SignInCredentials } from '../sign-in/sign-in.models';
import { type AuthenticationPort, SignInFailure } from './authentication.port';

const MALFORMED_MESSAGE = 'The server returned an unexpected response. Please try again.';
const SIGN_IN_FAILED_MESSAGE = 'Email or password is incorrect.';
const REFRESH_FAILED_MESSAGE = 'Your session has expired. Please sign in again.';

/**
 * Real-backend identity adapter. Implements both the sign-in port and the
 * platform refresh port so the two calls share one HTTP client and the same
 * response mapping. Swapped in for the fake adapter in production builds
 * (see `auth-data-access.providers.production.ts` and angular.json).
 *
 * Auth requests always run with SKIP_AUTH so the auth interceptor never
 * attaches a token or attempts a refresh on them — that is what prevents a
 * failing refresh from recursing into another refresh.
 */
@Injectable()
export class HttpAuthenticationAdapter implements AuthenticationPort, SessionRefreshPort {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  async signIn(credentials: SignInCredentials): Promise<AuthenticatedSession> {
    try {
      const body = await firstValueFrom(
        this.http.post<unknown>(this.endpoint('sign-in'), credentials, {
          context: authRequestContext(),
        }),
      );
      return this.toSession(body);
    } catch (error) {
      throw toSignInFailure(error);
    }
  }

  async refresh(refreshToken: string): Promise<SessionPayload> {
    try {
      const body = await firstValueFrom(
        this.http.post<unknown>(
          this.endpoint('refresh'),
          { refreshToken },
          { context: authRequestContext() },
        ),
      );
      return this.toSession(body);
    } catch (error) {
      throw toRefreshFailure(error);
    }
  }

  private endpoint(resource: string): string {
    return `${this.config.apiBaseUrl}/auth/${resource}`;
  }

  private toSession(body: unknown): SessionPayload {
    if (!isRecord(body)) {
      throw new SignInFailure('invalid_response', MALFORMED_MESSAGE);
    }

    const accessToken = asNonEmptyString(body['accessToken']);
    const user = toUser(body['user']);
    if (!accessToken || !user) {
      throw new SignInFailure('invalid_response', MALFORMED_MESSAGE);
    }

    return {
      user,
      accessToken,
      refreshToken: asNonEmptyString(body['refreshToken']) ?? undefined,
      expiresAt: toExpiresAt(body['expiresAt']),
    };
  }
}

function authRequestContext(): HttpContext {
  return new HttpContext()
    .set(SKIP_AUTH, true)
    .set(SKIP_LOADING, true)
    .set(SUPPRESS_GLOBAL_ERROR, true);
}

function toSignInFailure(error: unknown): SignInFailure {
  if (error instanceof SignInFailure) {
    return error;
  }

  if (isApiError(error)) {
    if (error.status === 401 || error.status === 400 || error.status === 422) {
      return new SignInFailure('invalid_credentials', SIGN_IN_FAILED_MESSAGE);
    }
    if (error.status === 429) {
      return new SignInFailure(
        'too_many_requests',
        'Too many attempts. Please wait a moment and try again.',
      );
    }
    // 4xx detail is user-safe (5xx detail is scrubbed by the error interceptor).
    return new SignInFailure(
      'unexpected',
      error.status >= 500 || error.status === 0 ? SIGN_IN_FAILED_MESSAGE : error.message,
    );
  }

  return new SignInFailure('unexpected', SIGN_IN_FAILED_MESSAGE);
}

function toRefreshFailure(error: unknown): SignInFailure {
  // Any refresh failure means the caller must sign in again, so the message is
  // always the safe re-authenticate prompt regardless of the underlying cause.
  return error instanceof SignInFailure
    ? error
    : new SignInFailure('invalid_grant', REFRESH_FAILED_MESSAGE);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toUser(value: unknown): AuthUser | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asNonEmptyString(value['id']);
  const email = asNonEmptyString(value['email']);
  if (!id || !email) {
    return null;
  }

  return {
    id,
    email,
    fullName: asNonEmptyString(value['fullName']) ?? email,
    permissions: toStringArray(value['permissions']),
    roles: toStringArray(value['roles']),
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/**
 * Accepts epoch milliseconds, an ISO-8601 string, or nothing. An unparseable
 * or absent value becomes `null`, which `SessionPayload` defines as "no known
 * expiry" (the session is then treated as non-expiring until a 401).
 */
function toExpiresAt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

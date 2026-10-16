// core/services/auth-session.service.ts

import { computed, inject, Injectable, signal } from '@angular/core';
import { SessionPayload } from '../auth/session.model';
import { SESSION_REFRESH_PORT } from '../auth/session-refresh.port';
import { STORAGE } from '../storage/storage.port';

export type { AuthUser } from '../auth/session.model';

const SESSION_STORAGE_KEY = 'app.session.v1';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly storage = inject(STORAGE);
  private readonly refresher = inject(SESSION_REFRESH_PORT, { optional: true });

  private readonly _user = signal<SessionPayload['user'] | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _refreshToken = signal<string | null>(null);
  private readonly _expiresAt = signal<number | null>(null);

  private expiryTimerId: ReturnType<typeof setTimeout> | null = null;
  private inflightRefresh: Promise<boolean> | null = null;

  readonly user = this._user.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly expiresAt = this._expiresAt.asReadonly();

  readonly isAuthenticated = computed(() => {
    const expiresAt = this._expiresAt();
    return (
      this._user() !== null &&
      this._accessToken() !== null &&
      (expiresAt === null || expiresAt > Date.now())
    );
  });

  setSession(session: SessionPayload): void {
    this._user.set(session.user);
    this._accessToken.set(session.accessToken);
    this._refreshToken.set(session.refreshToken ?? null);
    this._expiresAt.set(session.expiresAt);
    this.persist(session);
    this.scheduleExpiry();
  }

  clearSession(): void {
    this._user.set(null);
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._expiresAt.set(null);
    this.cancelExpiryTimer();
    this.storage.removeItem(SESSION_STORAGE_KEY);
  }

  /**
   * Restores a persisted session at startup. Expired sessions are refreshed
   * once when a refresh token and refresher adapter are available.
   */
  async restoreSession(): Promise<void> {
    const stored = this.readStoredSession();
    if (!stored) {
      return;
    }

    if (stored.expiresAt === null || stored.expiresAt > Date.now()) {
      this.setSession(stored);
      return;
    }

    if (stored.refreshToken && this.refresher) {
      this._refreshToken.set(stored.refreshToken);
      const refreshed = await this.refreshOnce();
      if (!refreshed) {
        this.clearSession();
      }
      return;
    }

    this.clearSession();
  }

  /**
   * Single-flight refresh: concurrent 401 responses share one refresh call.
   * Clears the session when the refresh fails.
   */
  refreshOnce(): Promise<boolean> {
    if (this.inflightRefresh) {
      return this.inflightRefresh;
    }

    this.inflightRefresh = this.performRefresh()
      .then((refreshed) => {
        if (!refreshed) {
          this.clearSession();
        }
        return refreshed;
      })
      .finally(() => {
        this.inflightRefresh = null;
      });

    return this.inflightRefresh;
  }

  hasPermission(permission: string): boolean {
    return this._user()?.permissions.includes(permission) ?? false;
  }

  hasRole(role: string): boolean {
    return this._user()?.roles.includes(role) ?? false;
  }

  private async performRefresh(): Promise<boolean> {
    const refreshToken = this._refreshToken();
    if (!refreshToken || !this.refresher) {
      return false;
    }

    try {
      this.setSession(await this.refresher.refresh(refreshToken));
      return true;
    } catch {
      return false;
    }
  }

  private persist(session: SessionPayload): void {
    this.storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  private readStoredSession(): SessionPayload | null {
    const raw = this.storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      return isSessionPayload(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private scheduleExpiry(): void {
    this.cancelExpiryTimer();
    const expiresAt = this._expiresAt();
    if (expiresAt === null) {
      return;
    }

    const delay = Math.max(1_000, expiresAt - Date.now());
    this.expiryTimerId = setTimeout(() => {
      void this.refreshOnce();
    }, delay);
  }

  private cancelExpiryTimer(): void {
    if (this.expiryTimerId !== null) {
      clearTimeout(this.expiryTimerId);
      this.expiryTimerId = null;
    }
  }
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SessionPayload>;
  return (
    !!candidate.user &&
    typeof candidate.user.id === 'string' &&
    Array.isArray(candidate.user.permissions) &&
    Array.isArray(candidate.user.roles) &&
    typeof candidate.accessToken === 'string' &&
    (candidate.expiresAt === null || typeof candidate.expiresAt === 'number')
  );
}

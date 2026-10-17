// core/services/auth-session.service.ts

import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { SessionPayload } from '../auth/session.model';
import { SESSION_REFRESH_PORT } from '../auth/session-refresh.port';
import { STORAGE, StorageChange } from '../storage/storage.port';
import { CLOCK } from '../time/clock.port';

export type { AuthUser } from '../auth/session.model';

const SESSION_STORAGE_KEY = 'app.session.v1';

/**
 * Floor for a scheduled expiry timer: a token that expired a moment ago must
 * not spin the timer in a tight loop, and `restoreSession` already handles the
 * already-expired case synchronously.
 */
const MIN_TIMER_DELAY_MS = 1_000;

/**
 * Ceiling for a single timer delay. `setTimeout` overflows its 32-bit delay
 * (≈24.8 days) and would fire immediately, so long-lived sessions clamp here
 * and re-arm in `onExpiryTimer` when the timer fires early.
 */
const MAX_TIMER_DELAY_MS = 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly storage = inject(STORAGE);
  private readonly refresher = inject(SESSION_REFRESH_PORT, { optional: true });
  private readonly clock = inject(CLOCK);

  private readonly _user = signal<SessionPayload['user'] | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _refreshToken = signal<string | null>(null);
  private readonly _expiresAt = signal<number | null>(null);

  private expiryTimerId: unknown = null;
  private inflightRefresh: Promise<boolean> | null = null;
  private restorePromise: Promise<void> | null = null;

  readonly user = this._user.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly expiresAt = this._expiresAt.asReadonly();

  readonly isAuthenticated = computed(() => {
    const expiresAt = this._expiresAt();
    return (
      this._user() !== null &&
      this._accessToken() !== null &&
      (expiresAt === null || expiresAt > this.clock.now())
    );
  });

  constructor() {
    const unsubscribe = this.storage.subscribe?.((change) => this.onExternalChange(change));
    if (unsubscribe) {
      inject(DestroyRef).onDestroy(unsubscribe);
    }
  }

  setSession(session: SessionPayload): void {
    this.applySession(session);
    this.persist(session);
  }

  clearSession(): void {
    this.clearLocalState();
    this.storage.removeItem(SESSION_STORAGE_KEY);
  }

  /**
   * Restores a persisted session at startup. Idempotent and single-flight:
   * repeated calls (e.g. a duplicated app initializer) share one restore and
   * never trigger a second refresh.
   */
  restoreSession(): Promise<void> {
    this.restorePromise ??= this.performRestoreSession();
    return this.restorePromise;
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

  private async performRestoreSession(): Promise<void> {
    const stored = parseStoredSession(this.storage.getItem(SESSION_STORAGE_KEY));
    if (!stored) {
      return;
    }

    if (stored.expiresAt === null || stored.expiresAt > this.clock.now()) {
      this.applySession(stored);
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

  /** Applies session state without persisting (used for cross-tab adoption). */
  private applySession(session: SessionPayload): void {
    this._user.set(session.user);
    this._accessToken.set(session.accessToken);
    this._refreshToken.set(session.refreshToken ?? null);
    this._expiresAt.set(session.expiresAt);
    this.scheduleExpiry();
  }

  /** Drops in-memory session state without touching storage. */
  private clearLocalState(): void {
    this._user.set(null);
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._expiresAt.set(null);
    this.cancelExpiryTimer();
  }

  /**
   * Reacts to a change another tab made to the session key: adopt a new
   * session, or drop the local one when the other tab signed out. Never
   * re-persists, so the two tabs cannot echo each other.
   */
  private onExternalChange(change: StorageChange): void {
    if (change.key !== SESSION_STORAGE_KEY) {
      return;
    }

    const session = parseStoredSession(change.value);
    if (session) {
      this.applySession(session);
    } else if (change.value === null) {
      this.clearLocalState();
    } else {
      // Another tab wrote something unparseable; treat it as corrupt.
      this.clearLocalState();
    }
  }

  private persist(session: SessionPayload): void {
    this.storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  private scheduleExpiry(): void {
    this.cancelExpiryTimer();
    const expiresAt = this._expiresAt();
    if (expiresAt === null) {
      return;
    }
    this.armExpiryTimer(expiresAt);
  }

  private armExpiryTimer(expiresAt: number): void {
    const delay = Math.min(
      Math.max(expiresAt - this.clock.now(), MIN_TIMER_DELAY_MS),
      MAX_TIMER_DELAY_MS,
    );
    this.expiryTimerId = this.clock.setTimer(delay, () => this.onExpiryTimer(expiresAt));
  }

  private onExpiryTimer(expiresAt: number): void {
    this.expiryTimerId = null;

    // Fired early because the delay was clamped (or the session was replaced):
    // re-arm for the remaining time instead of refreshing prematurely.
    if (expiresAt - this.clock.now() > MIN_TIMER_DELAY_MS) {
      this.armExpiryTimer(expiresAt);
      return;
    }

    void this.refreshOnce();
  }

  private cancelExpiryTimer(): void {
    if (this.expiryTimerId !== null) {
      this.clock.clearTimer(this.expiryTimerId);
      this.expiryTimerId = null;
    }
  }
}

function parseStoredSession(raw: string | null): SessionPayload | null {
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

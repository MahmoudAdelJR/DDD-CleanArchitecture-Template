import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthUser, SessionPayload } from '../auth/session.model';
import { SESSION_REFRESH_PORT, SessionRefreshPort } from '../auth/session-refresh.port';
import { STORAGE } from '../storage/storage.port';
import { FakeClock } from '../testing/fake-clock';
import { MemoryStorage } from '../testing/memory-storage';
import { CLOCK } from '../time/clock.port';
import { AuthSessionService } from './auth-session.service';

const USER: AuthUser = {
  id: '1',
  fullName: 'Ada Admin',
  email: 'admin@demo.local',
  permissions: ['customers.read'],
  roles: ['admin'],
};

const SESSION_KEY = 'app.session.v1';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

async function flushMicrotasks(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

describe('AuthSessionService', () => {
  let storage: MemoryStorage;
  let clock: FakeClock;

  function session(
    expiresAt: number | null,
    accessToken = 'token',
    refreshToken = 'refresh',
  ): SessionPayload {
    return { user: USER, accessToken, refreshToken, expiresAt };
  }

  function setup(refresher?: SessionRefreshPort): AuthSessionService {
    clock = new FakeClock(1_700_000_000_000);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: STORAGE, useClass: MemoryStorage },
        { provide: CLOCK, useValue: clock },
        ...(refresher ? [{ provide: SESSION_REFRESH_PORT, useValue: refresher }] : []),
      ],
    });
    storage = TestBed.inject(STORAGE) as MemoryStorage;
    return TestBed.inject(AuthSessionService);
  }

  afterEach(() => {
    TestBed.inject(AuthSessionService).clearSession();
  });

  it('persists the session on setSession and removes it on clearSession', () => {
    const service = setup();

    service.setSession(session(null, 'a', 'r'));
    expect(storage.getItem(SESSION_KEY)).toContain('"accessToken":"a"');

    service.clearSession();
    expect(storage.getItem(SESSION_KEY)).toBeNull();
  });

  it('treats a session as unauthenticated once its expiry has passed', () => {
    const service = setup();

    service.setSession(session(clock.now() - 1));
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('restores a still-valid persisted session', async () => {
    const service = setup();
    service.clearSession();
    storage.setItem(SESSION_KEY, JSON.stringify(session(clock.now() + 60_000, 'stored')));

    await service.restoreSession();

    expect(service.isAuthenticated()).toBeTrue();
    expect(service.accessToken()).toBe('stored');
  });

  it('discards corrupt persisted sessions', async () => {
    const service = setup();
    storage.setItem(SESSION_KEY, 'not-json');

    await service.restoreSession();

    expect(service.isAuthenticated()).toBeFalse();
  });

  it('refreshes an expired session during restore when a refresher is available', async () => {
    const refresher = jasmine.createSpyObj<SessionRefreshPort>('SessionRefreshPort', ['refresh']);
    refresher.refresh.and.callFake(() => Promise.resolve(session(clock.now() + 60_000, 'fresh')));
    const service = setup(refresher);

    storage.setItem(SESSION_KEY, JSON.stringify(session(clock.now() - 1, 'old', 'refresh-1')));
    await service.restoreSession();

    expect(refresher.refresh).toHaveBeenCalledWith('refresh-1');
    expect(service.accessToken()).toBe('fresh');
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('clears the session when the expired session cannot be refreshed', async () => {
    const refresher: SessionRefreshPort = { refresh: () => Promise.reject(new Error('revoked')) };
    const service = setup(refresher);

    storage.setItem(SESSION_KEY, JSON.stringify(session(clock.now() - 1)));
    await service.restoreSession();

    expect(service.isAuthenticated()).toBeFalse();
    expect(storage.getItem(SESSION_KEY)).toBeNull();
  });

  it('performs a single refresh call for concurrent refreshOnce invocations', async () => {
    let resolveRefresh: (value: SessionPayload) => void = () => {};
    const refresh = jasmine
      .createSpy('refresh')
      .and.returnValue(new Promise<SessionPayload>((resolve) => (resolveRefresh = resolve)));
    const service = setup({ refresh });

    service.setSession(session(clock.now() - 1, 'old', 'refresh-1'));

    const first = service.refreshOnce();
    const second = service.refreshOnce();

    resolveRefresh(session(clock.now() + 60_000, 'fresh'));
    const results = await Promise.all([first, second]);

    expect(refresh.calls.count()).toBe(1);
    expect(results).toEqual([true, true]);
  });

  it('clears the session when refreshOnce fails', async () => {
    const service = setup({ refresh: () => Promise.reject(new Error('nope')) });
    service.setSession(session(null, 'old', 'refresh-1'));

    const refreshed = await service.refreshOnce();

    expect(refreshed).toBeFalse();
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('restores only once across repeated restoreSession calls', async () => {
    const refresh = jasmine
      .createSpy('refresh')
      .and.callFake(() => Promise.resolve(session(clock.now() + 60_000, 'fresh')));
    const service = setup({ refresh });

    storage.setItem(SESSION_KEY, JSON.stringify(session(clock.now() - 1, 'old', 'refresh-1')));

    await Promise.all([service.restoreSession(), service.restoreSession()]);
    await service.restoreSession();

    expect(refresh.calls.count()).toBe(1);
  });

  it('proactively refreshes when the access token expires', async () => {
    const refresh = jasmine
      .createSpy('refresh')
      .and.callFake(() => Promise.resolve(session(clock.now() + 60_000, 'fresh')));
    const service = setup({ refresh });

    service.setSession(session(clock.now() + 5_000, 'old', 'refresh-1'));
    expect(refresh).not.toHaveBeenCalled();

    clock.advanceBy(5_000);
    await flushMicrotasks();

    expect(refresh.calls.count()).toBe(1);
    expect(service.accessToken()).toBe('fresh');
  });

  it('re-arms the expiry timer for sessions longer than the timer cap', async () => {
    const refresh = jasmine
      .createSpy('refresh')
      .and.callFake(() => Promise.resolve(session(clock.now() + 60_000, 'fresh')));
    const service = setup({ refresh });

    service.setSession(session(clock.now() + 40 * DAY_MS, 'old', 'refresh-1'));
    expect(clock.pendingTimers).toBe(1);

    clock.advanceBy(DAY_MS);
    expect(refresh).not.toHaveBeenCalled();
    expect(clock.pendingTimers).toBe(1);

    clock.advanceBy(39 * DAY_MS);
    await flushMicrotasks();

    expect(refresh.calls.count()).toBe(1);
    expect(service.accessToken()).toBe('fresh');
  });

  it('adopts a session another tab persisted, without re-writing storage', () => {
    const service = setup();
    const persisted = JSON.stringify(session(clock.now() + 60_000, 'other-tab'));

    const before = storage.getItem(SESSION_KEY);
    storage.emitExternalChange(SESSION_KEY, persisted);

    expect(service.isAuthenticated()).toBeTrue();
    expect(service.accessToken()).toBe('other-tab');
    expect(storage.getItem(SESSION_KEY)).toBe(before);
  });

  it('drops the local session when another tab signs out', () => {
    const service = setup();
    service.setSession(session(clock.now() + 60_000, 'mine'));
    expect(service.isAuthenticated()).toBeTrue();

    storage.emitExternalChange(SESSION_KEY, null);

    expect(service.isAuthenticated()).toBeFalse();
    expect(service.accessToken()).toBeNull();
  });

  it('ignores unrelated keys and clears state on a corrupt external value', () => {
    const service = setup();
    service.setSession(session(clock.now() + 60_000, 'mine'));

    storage.emitExternalChange('app.language', 'fr');
    expect(service.accessToken()).toBe('mine');

    storage.emitExternalChange(SESSION_KEY, 'not-json');
    expect(service.isAuthenticated()).toBeFalse();
  });
});

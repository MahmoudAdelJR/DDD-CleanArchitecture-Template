import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthUser, SessionPayload } from '../auth/session.model';
import { SESSION_REFRESH_PORT, SessionRefreshPort } from '../auth/session-refresh.port';
import { STORAGE } from '../storage/storage.port';
import { MemoryStorage } from '../testing/memory-storage';
import { AuthSessionService } from './auth-session.service';

const USER: AuthUser = {
  id: '1',
  fullName: 'Ada Admin',
  email: 'admin@demo.local',
  permissions: ['customers.read'],
  roles: ['admin'],
};

function session(
  expiresAt: number | null,
  accessToken = 'token',
  refreshToken = 'refresh',
): SessionPayload {
  return { user: USER, accessToken, refreshToken, expiresAt };
}

describe('AuthSessionService', () => {
  let storage: MemoryStorage;

  function setup(refresher?: SessionRefreshPort): AuthSessionService {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: STORAGE, useClass: MemoryStorage },
        ...(refresher ? [{ provide: SESSION_REFRESH_PORT, useValue: refresher }] : []),
      ],
    });
    storage = TestBed.inject(STORAGE) as MemoryStorage;
    return TestBed.inject(AuthSessionService);
  }

  afterEach(() => {
    const service = TestBed.inject(AuthSessionService);
    service.clearSession();
  });

  it('persists the session on setSession and removes it on clearSession', () => {
    const service = setup();

    service.setSession(session(null, 'a', 'r'));
    expect(storage.getItem('app.session.v1')).toContain('"accessToken":"a"');

    service.clearSession();
    expect(storage.getItem('app.session.v1')).toBeNull();
  });

  it('treats a session as unauthenticated once its expiry has passed', () => {
    const service = setup();

    service.setSession(session(Date.now() - 1));
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('restores a still-valid persisted session', async () => {
    const service = setup();
    service.clearSession();
    storage.setItem('app.session.v1', JSON.stringify(session(Date.now() + 60_000, 'stored')));

    await service.restoreSession();

    expect(service.isAuthenticated()).toBeTrue();
    expect(service.accessToken()).toBe('stored');
  });

  it('discards corrupt persisted sessions', async () => {
    const service = setup();
    storage.setItem('app.session.v1', 'not-json');

    await service.restoreSession();

    expect(service.isAuthenticated()).toBeFalse();
  });

  it('refreshes an expired session during restore when a refresher is available', async () => {
    const refresher = jasmine.createSpyObj<SessionRefreshPort>('SessionRefreshPort', ['refresh']);
    refresher.refresh.and.resolveTo(session(Date.now() + 60_000, 'fresh'));
    const service = setup(refresher);

    storage.setItem('app.session.v1', JSON.stringify(session(Date.now() - 1, 'old', 'refresh-1')));
    await service.restoreSession();

    expect(refresher.refresh).toHaveBeenCalledWith('refresh-1');
    expect(service.accessToken()).toBe('fresh');
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('clears the session when the expired session cannot be refreshed', async () => {
    const refresher: SessionRefreshPort = { refresh: () => Promise.reject(new Error('revoked')) };
    const service = setup(refresher);

    storage.setItem('app.session.v1', JSON.stringify(session(Date.now() - 1)));
    await service.restoreSession();

    expect(service.isAuthenticated()).toBeFalse();
    expect(storage.getItem('app.session.v1')).toBeNull();
  });

  it('performs a single refresh call for concurrent refreshOnce invocations', async () => {
    let resolveRefresh: (value: SessionPayload) => void = () => {};
    const refresh = jasmine
      .createSpy('refresh')
      .and.returnValue(new Promise<SessionPayload>((resolve) => (resolveRefresh = resolve)));
    const service = setup({ refresh });

    service.setSession(session(Date.now() - 1, 'old', 'refresh-1'));

    const first = service.refreshOnce();
    const second = service.refreshOnce();

    resolveRefresh(session(Date.now() + 60_000, 'fresh'));
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
});

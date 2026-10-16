import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SessionPayload } from '../auth/session.model';
import { SESSION_REFRESH_PORT } from '../auth/session-refresh.port';
import { provideAppConfig, AppConfig } from '../config/app-config';
import { SKIP_AUTH } from '../http/http-context';
import { STORAGE } from '../storage/storage.port';
import { MemoryStorage } from '../testing/memory-storage';
import { AuthSessionService } from '../services/auth-session.service';
import { authInterceptor } from './auth.interceptor';

const CONFIG: AppConfig = {
  apiBaseUrl: '/api',
  trustedOrigins: ['http://trusted.example'],
  supportedLocales: ['en'],
  defaultLocale: 'en',
};

const USER = { id: '1', fullName: 'Ada', email: 'a@b.c', permissions: [], roles: [] };

async function settle(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let session: AuthSessionService;

  function setup(refreshImpl?: (token: string) => Promise<SessionPayload>): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideAppConfig(CONFIG),
        { provide: STORAGE, useClass: MemoryStorage },
        {
          provide: SESSION_REFRESH_PORT,
          useValue: {
            refresh: refreshImpl ?? (() => Promise.reject(new Error('no refresh configured'))),
          },
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSessionService);
  }

  function signedIn(expiresAt: number | null = null): void {
    session.setSession({
      user: USER,
      accessToken: 'initial-token',
      refreshToken: 'refresh-1',
      expiresAt,
    });
  }

  afterEach(() => {
    session.clearSession();
  });

  it('attaches the bearer token to same-origin relative requests', () => {
    setup();
    signedIn();

    http.get('/api/customers').subscribe();
    const req = controller.expectOne('/api/customers');
    expect(req.request.headers.get('Authorization')).toBe('Bearer initial-token');
    req.flush({});
  });

  it('attaches the bearer token to configured trusted origins', () => {
    setup();
    signedIn();

    http.get('http://trusted.example/api/customers').subscribe();
    const req = controller.expectOne('http://trusted.example/api/customers');
    expect(req.request.headers.get('Authorization')).toBe('Bearer initial-token');
    req.flush({});
  });

  it('never attaches the bearer token to untrusted origins', () => {
    setup();
    signedIn();

    http.get('http://evil.example/collect').subscribe();
    const req = controller.expectOne('http://evil.example/collect');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('honours the SKIP_AUTH context token', () => {
    setup();
    signedIn();

    http.get('/api/analytics', { context: new HttpContext().set(SKIP_AUTH, true) }).subscribe();
    const req = controller.expectOne('/api/analytics');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('refreshes and retries the original request once after a 401', async () => {
    const newSession: SessionPayload = {
      user: USER,
      accessToken: 'fresh-token',
      refreshToken: 'refresh-2',
      expiresAt: Date.now() + 60_000,
    };
    setup(() => Promise.resolve(newSession));
    signedIn();

    let responseBody: unknown = null;
    http.get('/api/customers').subscribe((body) => (responseBody = body));

    const first = controller.expectOne('/api/customers');
    first.flush({}, { status: 401, statusText: 'Unauthorized' });
    await settle();

    const retry = controller.expectOne('/api/customers');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    retry.flush({ ok: true });

    expect(responseBody).toEqual({ ok: true });
    expect(session.accessToken()).toBe('fresh-token');
  });

  it('sends concurrent 401 responses through a single refresh call', async () => {
    const newSession: SessionPayload = {
      user: USER,
      accessToken: 'fresh-token',
      refreshToken: 'refresh-2',
      expiresAt: Date.now() + 60_000,
    };
    const refresh = jasmine.createSpy('refresh').and.resolveTo(newSession);
    setup(() => refresh());

    signedIn();
    http.get('/api/a').subscribe();
    http.get('/api/b').subscribe();

    const a = controller.expectOne('/api/a');
    const b = controller.expectOne('/api/b');
    a.flush({}, { status: 401, statusText: 'Unauthorized' });
    b.flush({}, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(refresh.calls.count()).toBe(1);
    controller.expectOne('/api/a').flush({ ok: 'a' });
    controller.expectOne('/api/b').flush({ ok: 'b' });
  });

  it('clears the session and redirects to login when the refresh fails', async () => {
    setup(() => Promise.reject(new Error('revoked')));
    signedIn();

    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);

    let capturedError: unknown = null;
    http.get('/api/customers').subscribe({
      error: (error) => (capturedError = error),
    });

    controller.expectOne('/api/customers').flush({}, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(session.isAuthenticated()).toBeFalse();
    expect(capturedError).toBeTruthy();
    expect(navigate).toHaveBeenCalledWith(['/login'], jasmine.anything());
  });

  it('passes non-401 failures through untouched', () => {
    setup();
    signedIn();

    let capturedStatus: number | undefined;
    http.get('/api/customers').subscribe({
      error: (error: { status: number }) => (capturedStatus = error.status),
    });

    controller.expectOne('/api/customers').flush({}, { status: 500, statusText: 'Server error' });

    expect(capturedStatus).toBe(500);
  });
});

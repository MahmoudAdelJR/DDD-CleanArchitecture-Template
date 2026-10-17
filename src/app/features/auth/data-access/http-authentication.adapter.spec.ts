import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SessionPayload } from '../../../core/auth/session.model';
import { DEFAULT_APP_CONFIG, provideAppConfig } from '../../../core/config/app-config';
import { SKIP_AUTH, SUPPRESS_GLOBAL_ERROR } from '../../../core/http/http-context';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { SignInFailure } from './authentication.port';
import { HttpAuthenticationAdapter } from './http-authentication.adapter';

const SESSION_BODY = {
  user: {
    id: '1',
    fullName: 'Ada Admin',
    email: 'admin@api.example',
    permissions: ['customers.read'],
    roles: ['admin'],
  },
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: 4_102_444_800_000,
};

/**
 * Runs behind the real error interceptor so the adapter sees the same
 * normalized ApiError contract the application produces.
 */
describe('HttpAuthenticationAdapter', () => {
  let adapter: HttpAuthenticationAdapter;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideAppConfig(DEFAULT_APP_CONFIG),
        HttpAuthenticationAdapter,
      ],
    });

    adapter = TestBed.inject(HttpAuthenticationAdapter);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('posts credentials and maps the returned session', async () => {
    const promise = adapter.signIn({ email: 'admin@api.example', password: 's3cret' });

    const request = controller.expectOne('/api/auth/sign-in');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'admin@api.example', password: 's3cret' });
    request.flush(SESSION_BODY);

    const session = await promise;
    expect(session.accessToken).toBe('access-1');
    expect(session.refreshToken).toBe('refresh-1');
    expect(session.user.email).toBe('admin@api.example');
    expect(session.expiresAt).toBe(4_102_444_800_000);
  });

  it('marks auth requests as skip-auth and suppresses the global error toast', async () => {
    const promise = adapter.signIn({ email: 'admin@api.example', password: 's3cret' });

    const request = controller.expectOne('/api/auth/sign-in');
    expect(request.request.context.get(SKIP_AUTH)).toBeTrue();
    expect(request.request.context.get(SUPPRESS_GLOBAL_ERROR)).toBeTrue();
    request.flush(SESSION_BODY);

    await promise;
  });

  it('maps a 401 sign-in to an invalid_credentials SignInFailure', async () => {
    let captured: unknown = null;
    const promise = adapter
      .signIn({ email: 'admin@api.example', password: 'wrong' })
      .catch((error: unknown) => {
        captured = error;
        return null;
      });

    controller
      .expectOne('/api/auth/sign-in')
      .flush({ detail: 'bad' }, { status: 401, statusText: 'Unauthorized' });
    await promise;

    expect(captured).toBeInstanceOf(SignInFailure);
    expect((captured as SignInFailure).code).toBe('invalid_credentials');
  });

  it('exchanges the refresh token and maps the new session', async () => {
    const promise = adapter.refresh('refresh-1');

    const request = controller.expectOne('/api/auth/refresh');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ refreshToken: 'refresh-1' });
    request.flush({ ...SESSION_BODY, accessToken: 'access-2' });

    const session: SessionPayload = await promise;
    expect(session.accessToken).toBe('access-2');
  });

  it('maps a refused refresh to an invalid_grant SignInFailure', async () => {
    let captured: unknown = null;
    const promise = adapter.refresh('revoked').catch((error: unknown) => {
      captured = error;
      return null;
    });

    controller
      .expectOne('/api/auth/refresh')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await promise;

    expect(captured).toBeInstanceOf(SignInFailure);
    expect((captured as SignInFailure).code).toBe('invalid_grant');
  });

  it('normalizes a malformed payload to an invalid_response SignInFailure', async () => {
    let captured: unknown = null;
    const promise = adapter.signIn({ email: 'a@b.c', password: 'p' }).catch((error: unknown) => {
      captured = error;
      return null;
    });

    controller.expectOne('/api/auth/sign-in').flush({ accessToken: 'access-1' });
    await promise;

    expect(captured).toBeInstanceOf(SignInFailure);
    expect((captured as SignInFailure).code).toBe('invalid_response');
  });

  it('parses an ISO-8601 expiry and drops a missing refresh token', async () => {
    const promise = adapter.signIn({ email: 'a@b.c', password: 'p' });

    controller.expectOne('/api/auth/sign-in').flush({
      user: { id: '9', email: 'a@b.c' },
      accessToken: 'access-9',
      expiresAt: '2026-01-02T03:04:05.000Z',
    });

    const session = await promise;
    expect(session.expiresAt).toBe(Date.parse('2026-01-02T03:04:05.000Z'));
    expect(session.user.fullName).toBe('a@b.c');
    expect(session.refreshToken).toBeUndefined();
  });
});

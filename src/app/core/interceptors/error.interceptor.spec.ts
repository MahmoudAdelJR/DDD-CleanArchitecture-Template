import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../http/api-error';
import { SUPPRESS_GLOBAL_ERROR } from '../http/http-context';
import { NotificationService } from '../services/notification.service';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let notifications: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    notifications = TestBed.inject(NotificationService);
  });

  function requestWithError(
    error: string | object,
    status = 400,
    context?: HttpContext,
  ): Promise<ApiError> {
    return new Promise((resolve) => {
      http.get('/api/resource', { context }).subscribe({
        error: (caught: ApiError) => resolve(caught),
      });
      controller.expectOne('/api/resource').flush(error, { status, statusText: 'Failed' });
    });
  }

  it('normalizes legacy array-shaped problem details', async () => {
    const apiError = await requestWithError({
      title: 'One or more errors occurred.',
      status: 400,
      errors: [{ code: 'DuplicateName', description: 'The name is taken.' }],
    });

    expect(apiError).toBeInstanceOf(ApiError);
    expect(apiError.message).toBe('The name is taken.');
    expect(apiError.validationErrors).toEqual({ DuplicateName: ['The name is taken.'] });
    expect(notifications.notifications().length).toBe(1);
    expect(notifications.notifications()[0].type).toBe('error');
  });

  it('normalizes ASP.NET dictionary-shaped validation errors', async () => {
    const apiError = await requestWithError({
      type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: {
        Email: ['The Email field is not a valid e-mail address.', 'Email is required.'],
        Password: ['The Password field is required.'],
      },
    });

    expect(apiError.validationErrors['Email']?.length).toBe(2);
    expect(apiError.message).toContain('not a valid e-mail address');
    expect(apiError.code).toBe('rfc7231');
  });

  it('derives a safe message and code for problem details without errors', async () => {
    const apiError = await requestWithError(
      { detail: 'The order cannot be shipped twice.', code: 'AlreadyShipped' },
      409,
    );

    expect(apiError.message).toBe('The order cannot be shipped twice.');
    expect(apiError.code).toBe('AlreadyShipped');
    expect(apiError.status).toBe(409);
  });

  it('does not leak raw server text for 5xx responses', async () => {
    const apiError = await requestWithError(
      'System.InvalidOperationException: stack trace details',
      500,
    );

    expect(apiError.message).toBe('The server encountered an unexpected error.');
  });

  it('reports an unreachable service for network failures', async () => {
    const apiError = await new Promise<ApiError>((resolve) => {
      http.get('/api/resource').subscribe({
        error: (caught: ApiError) => resolve(caught),
      });
      controller
        .expectOne('/api/resource')
        .error(new ErrorEvent('Network error'), { status: 0, statusText: 'Unknown error' });
    });

    expect(apiError.message).toContain('unreachable');
  });

  it('honours SUPPRESS_GLOBAL_ERROR while still throwing ApiError', async () => {
    const context = new HttpContext().set(SUPPRESS_GLOBAL_ERROR, true);
    const apiError = await requestWithError({ detail: 'Quiet failure.' }, 400, context);

    expect(apiError.message).toBe('Quiet failure.');
    expect(notifications.notifications().length).toBe(0);
  });

  it('captures the correlation id from response headers', async () => {
    return new Promise<void>((resolve) => {
      let captured: ApiError | null = null;
      http.get('/api/resource').subscribe({
        error: (caught: ApiError) => {
          captured = caught;
          expect(caught.correlationId).toBe('abc-123');
          resolve();
        },
      });

      controller.expectOne('/api/resource').flush(
        { detail: 'boom' },
        {
          status: 500,
          statusText: 'Failed',
          headers: { 'x-correlation-id': 'abc-123' },
        },
      );
      void captured;
    });
  });
});

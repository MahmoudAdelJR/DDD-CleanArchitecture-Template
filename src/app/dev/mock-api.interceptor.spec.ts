import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { AppConfig, provideAppConfig } from '../core/config/app-config';
import { resetMockCustomers } from './mock-fixtures';
import { mockApiInterceptor } from './mock-api.interceptor';

const MOCK_CONFIG: AppConfig = {
  apiBaseUrl: '/api',
  trustedOrigins: [],
  supportedLocales: ['en'],
  defaultLocale: 'en',
  mockApi: true,
};

const DISABLED_CONFIG: AppConfig = { ...MOCK_CONFIG, mockApi: false };

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 350));
}

describe('mockApiInterceptor', () => {
  beforeEach(() => resetMockCustomers());

  function setup(config: AppConfig): { http: HttpClient; controller: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        provideHttpClientTesting(),
        provideAppConfig(config),
      ],
    });

    return {
      http: TestBed.inject(HttpClient),
      controller: TestBed.inject(HttpTestingController),
    };
  }

  it('answers the customer list from fixtures when enabled', async () => {
    const { http, controller } = setup(MOCK_CONFIG);

    let body: any = null;
    http.get<any>('/api/customers?page=1&pageSize=2').subscribe((value) => (body = value));

    await settle();

    expect(body.pageNumber).toBe(1);
    expect(body.items.length).toBe(2);
    expect(body.totalCount).toBe(5);
    expect(body.items[0].notes).toBeUndefined();
    controller.verify();
  });

  it('answers customer detail and mocks 404 as HttpErrorResponse', async () => {
    const { http } = setup(MOCK_CONFIG);

    const found = await http.get<any>('/api/customers/c1').toPromise();
    expect(found.company).toBe('Acme Industries');

    let captured: unknown = null;
    await http
      .get<any>('/api/customers/ghost')
      .toPromise()
      .catch((error) => (captured = error));

    expect(captured).toBeInstanceOf(HttpErrorResponse);
    expect((captured as HttpErrorResponse).status).toBe(404);
  });

  it('falls through to the backend for unmatched API routes', () => {
    const { http, controller } = setup(MOCK_CONFIG);

    let body: any = null;
    http.get<any>('/api/unknown').subscribe((value) => (body = value));
    const request = controller.expectOne('/api/unknown');
    request.flush({ real: true });

    expect(body).toEqual({ real: true });
  });

  it('passes everything through when mockApi is disabled', () => {
    const { http, controller } = setup(DISABLED_CONFIG);

    let body: any = null;
    http.get<any[]>('/api/customers').subscribe((value) => (body = value));
    const request = controller.expectOne('/api/customers');
    request.flush([{ id: 'c1', company: 'Reached the real backend' }]);

    expect(body.length).toBe(1);
    expect(body[0].company).toBe('Reached the real backend');
  });

  it('never intercepts untrusted third-party requests', () => {
    const { http, controller } = setup(MOCK_CONFIG);

    let body: any = null;
    http.get<any[]>('https://partner.example/api/customers').subscribe((value) => (body = value));
    const request = controller.expectOne('https://partner.example/api/customers');
    request.flush([]);

    expect(body).toEqual([]);
  });

  const INPUT = {
    company: 'Wonka Industries',
    contactName: 'Willy Wonka',
    email: 'willy@wonka.example',
    city: 'Chicago',
    status: 'active',
    notes: 'Golden tickets.',
  };

  it('creates a customer and returns it from a subsequent list request', async () => {
    const { http } = setup(MOCK_CONFIG);

    const created = await http.post<any>('/api/customers', INPUT).toPromise();
    expect(created.id).toBeTruthy();
    expect(created.company).toBe('Wonka Industries');

    const list = await http.get<any>('/api/customers?search=wonka&page=1&pageSize=5').toPromise();
    expect(list.totalCount).toBe(1);
    expect(list.items[0].id).toBe(created.id);
  });

  it('returns a 422 Problem Details body for invalid input', async () => {
    const { http } = setup(MOCK_CONFIG);

    let captured: unknown = null;
    await http
      .post('/api/customers', { ...INPUT, email: 'not-an-email' })
      .toPromise()
      .catch((error) => (captured = error));

    expect(captured).toBeInstanceOf(HttpErrorResponse);
    const response = captured as HttpErrorResponse;
    expect(response.status).toBe(422);
    expect(response.error.errors.email).toBeDefined();
  });

  it('returns 409 when the email already exists', async () => {
    const { http } = setup(MOCK_CONFIG);

    let captured: unknown = null;
    await http
      .post('/api/customers', { ...INPUT, email: 'wile@acme.example' })
      .toPromise()
      .catch((error) => (captured = error));

    expect((captured as HttpErrorResponse).status).toBe(409);
  });

  it('updates an existing customer and 404s for unknown ids', async () => {
    const { http } = setup(MOCK_CONFIG);

    const updated = await http
      .put<any>('/api/customers/c1', { ...INPUT, company: 'Acme Global' })
      .toPromise();
    expect(updated.company).toBe('Acme Global');
    expect(updated.id).toBe('c1');

    let captured: unknown = null;
    await http
      .put('/api/customers/ghost', INPUT)
      .toPromise()
      .catch((error) => (captured = error));
    expect((captured as HttpErrorResponse).status).toBe(404);
  });
});

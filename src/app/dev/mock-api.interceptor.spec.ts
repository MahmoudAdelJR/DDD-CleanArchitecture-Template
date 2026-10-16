import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { AppConfig, provideAppConfig } from '../core/config/app-config';
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
});

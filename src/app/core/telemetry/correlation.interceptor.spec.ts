import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppConfig, provideAppConfig } from '../config/app-config';
import {
  CORRELATION_ID,
  correlationInterceptor,
  generateCorrelationId,
} from './correlation.interceptor';

const CONFIG: AppConfig = {
  apiBaseUrl: '/api',
  trustedOrigins: ['http://trusted.example'],
  supportedLocales: ['en'],
  defaultLocale: 'en',
};

describe('correlationInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([correlationInterceptor])),
        provideHttpClientTesting(),
        provideAppConfig(CONFIG),
        { provide: CORRELATION_ID, useValue: 'corr-test-1' },
      ],
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  it('adds the correlation header to same-origin requests', () => {
    http.get('/api/customers').subscribe();
    const request = controller.expectOne('/api/customers');
    expect(request.request.headers.get('x-correlation-id')).toBe('corr-test-1');
    request.flush({});
  });

  it('adds the correlation header to trusted origins', () => {
    http.get('http://trusted.example/api/x').subscribe();
    const request = controller.expectOne('http://trusted.example/api/x');
    expect(request.request.headers.get('x-correlation-id')).toBe('corr-test-1');
    request.flush({});
  });

  it('does not touch untrusted third-party requests', () => {
    http.get('http://metrics.example/collect').subscribe();
    const request = controller.expectOne('http://metrics.example/collect');
    expect(request.request.headers.has('x-correlation-id')).toBeFalse();
    request.flush({});
  });

  it('respects a caller-provided correlation id', () => {
    http.get('/api/customers', { headers: { 'x-correlation-id': 'caller-1' } }).subscribe();
    const request = controller.expectOne('/api/customers');
    expect(request.request.headers.get('x-correlation-id')).toBe('caller-1');
    request.flush({});
  });

  it('generates unique correlation ids', () => {
    expect(generateCorrelationId()).not.toBe(generateCorrelationId());
  });
});

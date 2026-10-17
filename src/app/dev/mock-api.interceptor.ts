// src/app/dev/mock-api.interceptor.ts

import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { delay, of, throwError } from 'rxjs';
import { APP_CONFIG, isTrustedApiUrl } from '../core/config/app-config';
import {
  mockCustomerCreate,
  mockCustomerDetail,
  mockCustomerSearch,
  mockCustomerUpdate,
  type MockApiResult,
} from './mock-fixtures';

interface MockRoute {
  method: string;
  path: RegExp;
  resolve: (context: {
    params: URLSearchParams;
    match: RegExpExecArray;
    body: unknown;
  }) => MockApiResult;
}

/**
 * Add more endpoints here as your backend grows. Keep this table (and the
 * fixtures) in `dev/` so production code never depends on it; it is wired at
 * the composition root only, and stays dormant while AppConfig.mockApi=false.
 */
const MOCK_ROUTES: MockRoute[] = [
  {
    method: 'GET',
    path: /^\/api\/customers$/,
    resolve: ({ params }) => ({ status: 200, body: mockCustomerSearch(params) }),
  },
  {
    method: 'GET',
    path: /^\/api\/customers\/([\w-]+)$/,
    resolve: ({ match }) => {
      const customer = mockCustomerDetail(match[1]);
      return customer
        ? { status: 200, body: customer }
        : {
            status: 404,
            body: {
              type: 'https://tools.ietf.org/html/rfc9110#section-15.5.5',
              title: 'Not Found',
              status: 404,
              detail: `Customer "${match[1]}" was not found.`,
            },
          };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/customers$/,
    resolve: ({ body }) => mockCustomerCreate(body),
  },
  {
    method: 'PUT',
    path: /^\/api\/customers\/([\w-]+)$/,
    resolve: ({ match, body }) => mockCustomerUpdate(match[1], body),
  },
];

const LATENCY_MS = 150;

/**
 * Development-only mock backend. Registered innermost in the interceptor
 * pipeline: trusted requests that match a mock route are answered without
 * touching the network; everything else falls through to the real backend.
 */
export const mockApiInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(APP_CONFIG);

  if (!config.mockApi || !isTrustedApiUrl(request.url, config)) {
    return next(request);
  }

  let url: URL;
  try {
    url = new URL(request.urlWithParams, document.baseURI);
  } catch {
    return next(request);
  }

  const route = MOCK_ROUTES.find(
    (candidate) => candidate.method === request.method && candidate.path.test(url.pathname),
  );

  if (!route) {
    return next(request);
  }

  const match = route.path.exec(url.pathname) as RegExpExecArray;
  const reply = route.resolve({ params: url.searchParams, match, body: request.body });

  if (reply.status >= 400) {
    // Errors must flow as HttpErrorResponse so the error interceptor and
    // feature catch paths behave exactly like a real backend.
    return throwError(
      () =>
        new HttpErrorResponse({
          error: reply.body,
          status: reply.status,
          statusText: `Mock ${reply.status}`,
          url: request.url,
        }),
    );
  }

  const ok = new HttpResponse({ status: reply.status, body: reply.body });
  return of(ok).pipe(delay(LATENCY_MS));
};

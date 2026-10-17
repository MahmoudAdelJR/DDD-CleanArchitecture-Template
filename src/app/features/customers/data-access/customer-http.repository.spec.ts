import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PagedList } from '../../../shared/models/paged-list.model';
import { DEFAULT_APP_CONFIG, provideAppConfig } from '../../../core/config/app-config';
import { ApiError } from '../../../core/http/api-error';
import { SUPPRESS_GLOBAL_ERROR } from '../../../core/http/http-context';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import type { CustomerDetails, CustomerInput, CustomerSummary } from './customer.models';
import { CustomerHttpRepository } from './customer-http.repository';
import { CustomerConflictError, CustomerNotFoundError } from './customer.repository';

/**
 * These specs run the repository behind the real error interceptor — the same
 * boundary the application uses — so the ApiError contract is exercised
 * end-to-end rather than in isolation.
 */
describe('CustomerHttpRepository', () => {
  let repository: CustomerHttpRepository;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideAppConfig(DEFAULT_APP_CONFIG),
        CustomerHttpRepository,
      ],
    });

    repository = TestBed.inject(CustomerHttpRepository);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('serializes search, page and pageSize as query parameters', async () => {
    const body: PagedList<CustomerSummary> = {
      items: [],
      pageNumber: 2,
      pageSize: 5,
      totalCount: 0,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    };

    const promise = repository.search({ search: 'york', page: 2, pageSize: 5 });
    const request = controller.expectOne(
      (req) =>
        req.url === '/api/customers' &&
        req.params.get('search') === 'york' &&
        req.params.get('page') === '2' &&
        req.params.get('pageSize') === '5',
    );
    request.flush(body);

    await expectAsync(promise).toBeResolvedTo(body);
  });

  it('omits empty search terms from the query string', async () => {
    const body: PagedList<CustomerSummary> = {
      items: [],
      pageNumber: 1,
      pageSize: 5,
      totalCount: 0,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    };

    const promise = repository.search({ search: '', page: 1, pageSize: 5 });
    const request = controller.expectOne(
      (req) => req.url === '/api/customers' && !req.params.has('search'),
    );
    request.flush(body);

    await expectAsync(promise).toBeResolvedTo(body);
  });

  it('maps 404 responses to CustomerNotFoundError through the error interceptor', async () => {
    const promise = repository.findById('ghost');
    const request = controller.expectOne('/api/customers/ghost');
    request.flush({}, { status: 404, statusText: 'Not Found' });

    await expectAsync(promise).toBeRejectedWithError(CustomerNotFoundError);
  });

  it('rethrows non-404 failures as the normalized ApiError', async () => {
    let captured: unknown = null;
    const promise = repository.findById('c1').catch((error) => {
      captured = error;
      return null;
    });

    controller
      .expectOne('/api/customers/c1')
      .flush({ detail: 'internal' }, { status: 500, statusText: 'Server error' });
    await promise;

    expect(captured).toBeInstanceOf(ApiError);
    expect((captured as ApiError).status).toBe(500);
    // 5xx detail must not surface to users.
    expect((captured as ApiError).message).not.toContain('internal');
  });

  const INPUT: CustomerInput = {
    company: 'Wonka Industries',
    contactName: 'Willy Wonka',
    email: 'willy@wonka.example',
    city: 'Chicago',
    status: 'active',
    notes: 'Golden tickets.',
  };

  const DETAIL: CustomerDetails = { id: 'new', createdAt: '2025-01-01', ...INPUT };

  it('POSTs the input and suppresses the global error notification', async () => {
    const promise = repository.create(INPUT);
    const request = controller.expectOne(
      (req) => req.method === 'POST' && req.url === '/api/customers',
    );

    expect(request.request.body).toEqual(INPUT);
    expect(request.request.context.get(SUPPRESS_GLOBAL_ERROR)).toBeTrue();

    request.flush(DETAIL);
    await expectAsync(promise).toBeResolvedTo(DETAIL);
  });

  it('maps a 409 on create to CustomerConflictError', async () => {
    const promise = repository.create(INPUT);
    controller
      .expectOne((req) => req.method === 'POST' && req.url === '/api/customers')
      .flush({ title: 'Conflict', detail: 'duplicate' }, { status: 409, statusText: 'Conflict' });

    await expectAsync(promise).toBeRejectedWithError(CustomerConflictError);
  });

  it('PUTs to /customers/{id} and returns the updated detail', async () => {
    const promise = repository.update('c1', INPUT);
    const request = controller.expectOne(
      (req) => req.method === 'PUT' && req.url === '/api/customers/c1',
    );
    request.flush({ ...DETAIL, id: 'c1' });

    await expectAsync(promise).toBeResolvedTo({ ...DETAIL, id: 'c1' });
  });

  it('maps a 404 on update to CustomerNotFoundError', async () => {
    const promise = repository.update('ghost', INPUT);
    controller
      .expectOne((req) => req.method === 'PUT' && req.url === '/api/customers/ghost')
      .flush({}, { status: 404, statusText: 'Not Found' });

    await expectAsync(promise).toBeRejectedWithError(CustomerNotFoundError);
  });
});

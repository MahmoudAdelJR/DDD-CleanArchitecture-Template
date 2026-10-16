import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PagedList } from '../../../shared/models/paged-list.model';
import { DEFAULT_APP_CONFIG, provideAppConfig } from '../../../core/config/app-config';
import type { CustomerSummary } from './customer.models';
import { CustomerHttpRepository } from './customer-http.repository';
import { CustomerNotFoundError } from './customer.repository';

describe('CustomerHttpRepository', () => {
  let repository: CustomerHttpRepository;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
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
    const promise = repository.search({ search: '', page: 1, pageSize: 5 });
    const request = controller.expectOne(
      (req) => req.url === '/api/customers' && !req.params.has('search'),
    );
    request.flush({
      items: [],
      pageNumber: 1,
      pageSize: 5,
      totalCount: 0,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });

    await promise;
  });

  it('maps 404 responses to CustomerNotFoundError', async () => {
    const promise = repository.findById('ghost');
    const request = controller.expectOne('/api/customers/ghost');
    request.flush({}, { status: 404, statusText: 'Not Found' });

    await expectAsync(promise).toBeRejectedWithError(CustomerNotFoundError);
  });

  it('rethrows non-404 failures untouched', async () => {
    let captured: unknown = null;
    const promise = repository.findById('c1').catch((error) => {
      captured = error;
      return null;
    });

    controller
      .expectOne('/api/customers/c1')
      .flush({}, { status: 500, statusText: 'Server error' });
    await promise;

    expect(captured).toBeTruthy();
  });
});

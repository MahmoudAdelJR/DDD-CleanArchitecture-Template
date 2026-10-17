import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PagedList } from '../../shared/models/paged-list.model';
import { CustomersStore } from './customers.store';
import type { CustomerSummary } from './data-access/customer.models';
import { CUSTOMER_REPOSITORY, CustomerRepository } from './data-access/customer.repository';
import {
  InMemoryCustomerRepository,
  resetInMemoryCustomers,
} from './data-access/in-memory-customer.repository';

describe('CustomersStore', () => {
  beforeEach(() => {
    resetInMemoryCustomers();
    TestBed.configureTestingModule({
      providers: [
        CustomersStore,
        { provide: CUSTOMER_REPOSITORY, useClass: InMemoryCustomerRepository },
        provideZonelessChangeDetection(),
      ],
    });
  });

  it('loads the first page on demand', async () => {
    const store = TestBed.inject(CustomersStore);

    store.load();
    await waitForReady(store);

    const state = store.state();
    expect(state.status).toBe('ready');
    expect(state.result?.pageNumber).toBe(1);
    expect(state.result?.items.length).toBe(5);
    expect(state.result?.totalCount).toBe(9);
    expect(state.result?.hasNextPage).toBeTrue();
  });

  it('filters and re-paginates from page one when searching', async () => {
    const store = TestBed.inject(CustomersStore);

    store.searchFor('new york');
    await waitForReady(store);

    const state = store.state();
    expect(state.result?.totalCount).toBe(2);
    expect(state.result?.items.every((c) => c.city.toLowerCase() === 'new york')).toBeTrue();
  });

  it('clamps the requested page to the available range', async () => {
    const store = TestBed.inject(CustomersStore);

    store.searchFor('gotham');
    await waitForReady(store);
    expect(store.state().result?.totalCount).toBe(1);

    store.goToPage(99);
    await waitForReady(store);
    expect(store.state().result?.pageNumber).toBe(1);
  });

  async function waitForReady(store: CustomersStore): Promise<void> {
    while (store.state().status === 'loading') {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
});

describe('CustomersStore (latest-request-wins)', () => {
  it('ignores a stale response that resolves after a newer search', async () => {
    const pending: Array<(value: PagedList<CustomerSummary>) => void> = [];
    const fake: CustomerRepository = {
      search: () => new Promise((resolve) => pending.push(resolve)),
      findById: () => Promise.reject(new Error('unused')),
      create: () => Promise.reject(new Error('unused')),
      update: () => Promise.reject(new Error('unused')),
    };

    TestBed.configureTestingModule({
      providers: [
        CustomersStore,
        { provide: CUSTOMER_REPOSITORY, useValue: fake },
        provideZonelessChangeDetection(),
      ],
    });

    const store = TestBed.inject(CustomersStore);

    store.searchFor('first');
    store.searchFor('second');
    expect(pending.length).toBe(2);

    // The newest request resolves first, then the stale one lands afterwards.
    pending[1](pageFor('second'));
    await tick();
    pending[0](pageFor('first'));
    await tick();

    expect(store.state().search).toBe('second');
    expect(store.state().result?.items[0].company).toBe('second');
    expect(store.state().status).toBe('ready');
  });

  function pageFor(label: string): PagedList<CustomerSummary> {
    return {
      items: [
        {
          id: '1',
          company: label,
          contactName: 'Contact',
          email: 'c@example.com',
          city: 'City',
          status: 'active',
          createdAt: '2024-01-01',
        },
      ],
      pageNumber: 1,
      pageSize: 5,
      totalCount: 1,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    };
  }

  async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
});

import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CustomersStore } from './customers.store';
import { CUSTOMER_REPOSITORY } from './data-access/customer.repository';
import { InMemoryCustomerRepository } from './data-access/in-memory-customer.repository';

describe('CustomersStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CustomersStore,
        { provide: CUSTOMER_REPOSITORY, useClass: InMemoryCustomerRepository },
        provideZonelessChangeDetection()
      ]
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
    expect(state.result?.items.every(c => c.city.toLowerCase() === 'new york')).toBeTrue();
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
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
});

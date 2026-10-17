import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../core/http/api-error';
import { PagedList } from '../../shared/models/paged-list.model';
import { CustomerFormStore } from './customer-form.store';
import type {
  CustomerDetails,
  CustomerInput,
  CustomerSummary,
} from './data-access/customer.models';
import {
  CUSTOMER_REPOSITORY,
  CustomerConflictError,
  CustomerNotFoundError,
  CustomerRepository,
} from './data-access/customer.repository';

const DETAIL: CustomerDetails = {
  id: 'c1',
  company: 'Acme Industries',
  contactName: 'Wile E. Coyote',
  email: 'wile@acme.example',
  city: 'San Diego',
  status: 'active',
  createdAt: '2024-01-12',
  notes: 'Road-runner acquisition program.',
};

const INPUT: CustomerInput = {
  company: 'Acme Industries',
  contactName: 'Wile E. Coyote',
  email: 'wile@acme.example',
  city: 'San Diego',
  status: 'active',
  notes: 'Road-runner acquisition program.',
};

class FakeRepository implements CustomerRepository {
  findByIdError: Error | null = null;
  createError: Error | null = null;
  updateError: Error | null = null;

  search(): Promise<PagedList<CustomerSummary>> {
    return Promise.resolve({
      items: [],
      pageNumber: 1,
      pageSize: 5,
      totalCount: 0,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  }

  findById(): Promise<CustomerDetails> {
    return this.findByIdError ? Promise.reject(this.findByIdError) : Promise.resolve(DETAIL);
  }

  create(): Promise<CustomerDetails> {
    return this.createError ? Promise.reject(this.createError) : Promise.resolve(DETAIL);
  }

  update(): Promise<CustomerDetails> {
    return this.updateError ? Promise.reject(this.updateError) : Promise.resolve(DETAIL);
  }
}

describe('CustomerFormStore', () => {
  let repository: FakeRepository;

  beforeEach(() => {
    repository = new FakeRepository();
    TestBed.configureTestingModule({
      providers: [
        CustomerFormStore,
        { provide: CUSTOMER_REPOSITORY, useValue: repository },
        provideZonelessChangeDetection(),
      ],
    });
  });

  it('loads a customer into the store', async () => {
    const store = TestBed.inject(CustomerFormStore);

    await store.load('c1');

    expect(store.customer()).toEqual(DETAIL);
    expect(store.status()).toBe('idle');
    expect(store.notFound()).toBeFalse();
  });

  it('flags a missing customer as not-found rather than a generic error', async () => {
    repository.findByIdError = new CustomerNotFoundError('ghost');
    const store = TestBed.inject(CustomerFormStore);

    await store.load('ghost');

    expect(store.notFound()).toBeTrue();
    expect(store.loadError()).toBeNull();
  });

  it('creates a customer and returns it on success', async () => {
    const store = TestBed.inject(CustomerFormStore);

    const saved = await store.save(null, INPUT);

    expect(saved).toEqual(DETAIL);
    expect(store.saveError()).toBeNull();
    expect(store.status()).toBe('idle');
  });

  it('surfaces a conflict as a localized save error', async () => {
    repository.createError = new CustomerConflictError('duplicate email');
    const store = TestBed.inject(CustomerFormStore);

    const saved = await store.save(null, INPUT);

    expect(saved).toBeNull();
    expect(store.saveError()).toContain('already exists');
    expect(store.serverError()).toBeNull();
  });

  it('captures 422 field errors for the form to map', async () => {
    const apiError = new ApiError(
      422,
      'Validation failed',
      'validation',
      { email: ['Email is already used.'] },
      null,
      new HttpErrorResponse({ status: 422 }),
    );
    repository.updateError = apiError as unknown as Error;
    const store = TestBed.inject(CustomerFormStore);

    const saved = await store.save('c1', INPUT);

    expect(saved).toBeNull();
    expect(store.serverError()).toBe(apiError);
    expect(store.saveError()).toBe('Validation failed');
  });

  it('flags a missing customer on save as not-found', async () => {
    repository.updateError = new CustomerNotFoundError('c1');
    const store = TestBed.inject(CustomerFormStore);

    const saved = await store.save('c1', INPUT);

    expect(saved).toBeNull();
    expect(store.saveError()).toContain('no longer exists');
  });
});

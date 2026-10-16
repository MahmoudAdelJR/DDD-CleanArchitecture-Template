import { InjectionToken } from '@angular/core';
import { PagedList } from '../../../shared/models/paged-list.model';
import type { CustomerDetails, CustomerSearch, CustomerSummary } from './customer.models';

export class CustomerNotFoundError extends Error {
  constructor(readonly customerId: string) {
    super(`Customer "${customerId}" was not found.`);
    this.name = 'CustomerNotFoundError';
  }
}

export interface CustomerRepository {
  search(query: CustomerSearch): Promise<PagedList<CustomerSummary>>;
  findById(id: string): Promise<CustomerDetails>;
}

export const CUSTOMER_REPOSITORY = new InjectionToken<CustomerRepository>(
  'customers.CustomerRepository'
);

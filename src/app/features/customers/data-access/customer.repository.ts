import { InjectionToken } from '@angular/core';
import { PagedList } from '../../../shared/models/paged-list.model';
import type {
  CustomerDetails,
  CustomerInput,
  CustomerSearch,
  CustomerSummary,
} from './customer.models';

export class CustomerNotFoundError extends Error {
  constructor(readonly customerId: string) {
    super(`Customer "${customerId}" was not found.`);
    this.name = 'CustomerNotFoundError';
  }
}

/**
 * Raised when a write is rejected because it conflicts with existing data
 * (HTTP 409) — e.g. a duplicate email. Distinct from validation failures,
 * which arrive as field-level `ApiError.validationErrors`.
 */
export class CustomerConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerConflictError';
  }
}

export interface CustomerRepository {
  search(query: CustomerSearch): Promise<PagedList<CustomerSummary>>;
  findById(id: string): Promise<CustomerDetails>;
  create(input: CustomerInput): Promise<CustomerDetails>;
  update(id: string, input: CustomerInput): Promise<CustomerDetails>;
}

export const CUSTOMER_REPOSITORY = new InjectionToken<CustomerRepository>(
  'customers.CustomerRepository',
);

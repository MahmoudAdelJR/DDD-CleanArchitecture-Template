import { Provider } from '@angular/core';
import { CustomerHttpRepository } from './customer-http.repository';
import { CUSTOMER_REPOSITORY } from './customer.repository';

/**
 * Production data-access wiring: the customers slice talks to the real
 * backend. Replaces `customers-data-access.providers.ts` via angular.json
 * `fileReplacements`, so the in-memory fake is not bundled for release.
 */
export const customersDataAccessProviders: Provider[] = [
  { provide: CUSTOMER_REPOSITORY, useClass: CustomerHttpRepository },
];

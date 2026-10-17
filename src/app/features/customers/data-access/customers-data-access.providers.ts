import { Provider } from '@angular/core';
import { CUSTOMER_REPOSITORY } from './customer.repository';
import { InMemoryCustomerRepository } from './in-memory-customer.repository';

/**
 * Feature-scoped data-access wiring (development/demo default).
 *
 * Swap the repository implementation here to move from the in-memory fake to
 * a real HTTP adapter without touching the pages or the store. Production
 * builds replace this file with `customers-data-access.providers.production.ts`
 * via angular.json `fileReplacements`.
 */
export const customersDataAccessProviders: Provider[] = [
  { provide: CUSTOMER_REPOSITORY, useClass: InMemoryCustomerRepository },
];

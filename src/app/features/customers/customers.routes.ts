import { Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { AppPermissions } from '../../core/authorization/app-permissions';
import { permissionGuard } from '../../core/guards/permission.guard';
import { CUSTOMER_REPOSITORY } from './data-access/customer.repository';
import { InMemoryCustomerRepository } from './data-access/in-memory-customer.repository';
import { CustomersStore } from './customers.store';
import { CustomerDetailPageComponent } from './customer-detail/customer-detail-page.component';
import { CustomerListPageComponent } from './customer-list/customer-list-page.component';

/**
 * Feature-scoped data-access wiring. Swap the repository implementation here
 * to move from the in-memory fake to a real HTTP adapter without touching
 * the pages or the store.
 */
const customersDataAccessProviders: Provider[] = [
  { provide: CUSTOMER_REPOSITORY, useClass: InMemoryCustomerRepository }
];

export const CUSTOMERS_ROUTES: Routes = [
  {
    path: '',
    component: CustomerListPageComponent,
    canActivate: [permissionGuard(AppPermissions.customersRead)],
    providers: [...customersDataAccessProviders, CustomersStore]
  },
  {
    path: ':id',
    component: CustomerDetailPageComponent,
    canActivate: [permissionGuard(AppPermissions.customersRead)],
    providers: customersDataAccessProviders
  }
];

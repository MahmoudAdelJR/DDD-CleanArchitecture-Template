import { Routes } from '@angular/router';
import { AppPermissions } from '../../core/authorization/app-permissions';
import { permissionGuard } from '../../core/guards/permission.guard';
import { customersDataAccessProviders } from './data-access/customers-data-access.providers';
import { CustomersStore } from './customers.store';
import { CustomerDetailPageComponent } from './customer-detail/customer-detail-page.component';
import { CustomerListPageComponent } from './customer-list/customer-list-page.component';

export const CUSTOMERS_ROUTES: Routes = [
  {
    path: '',
    component: CustomerListPageComponent,
    canActivate: [permissionGuard(AppPermissions.customersRead)],
    providers: [...customersDataAccessProviders, CustomersStore],
  },
  {
    path: ':id',
    component: CustomerDetailPageComponent,
    canActivate: [permissionGuard(AppPermissions.customersRead)],
    providers: customersDataAccessProviders,
  },
];

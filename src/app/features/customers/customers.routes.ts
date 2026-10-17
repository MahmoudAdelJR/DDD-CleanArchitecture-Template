import { Routes } from '@angular/router';
import { AppPermissions } from '../../core/authorization/app-permissions';
import { permissionGuard } from '../../core/guards/permission.guard';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { CustomerFormStore } from './customer-form.store';
import { CustomerFormPageComponent } from './customer-form/customer-form-page.component';
import { CustomerDetailPageComponent } from './customer-detail/customer-detail-page.component';
import { CustomerListPageComponent } from './customer-list/customer-list-page.component';
import { customersDataAccessProviders } from './data-access/customers-data-access.providers';
import { CustomersStore } from './customers.store';

export const CUSTOMERS_ROUTES: Routes = [
  {
    path: '',
    component: CustomerListPageComponent,
    canActivate: [permissionGuard(AppPermissions.customersRead)],
    providers: [...customersDataAccessProviders, CustomersStore],
  },
  {
    path: 'new',
    component: CustomerFormPageComponent,
    canActivate: [permissionGuard(AppPermissions.customersWrite)],
    canDeactivate: [unsavedChangesGuard],
    providers: [...customersDataAccessProviders, CustomerFormStore],
  },
  {
    path: ':id/edit',
    component: CustomerFormPageComponent,
    canActivate: [permissionGuard(AppPermissions.customersWrite)],
    canDeactivate: [unsavedChangesGuard],
    providers: [...customersDataAccessProviders, CustomerFormStore],
  },
  {
    path: ':id',
    component: CustomerDetailPageComponent,
    canActivate: [permissionGuard(AppPermissions.customersRead)],
    providers: customersDataAccessProviders,
  },
];

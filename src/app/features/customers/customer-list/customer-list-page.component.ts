import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppPermissions } from '../../../core/authorization/app-permissions';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { CustomersStore } from '../customers.store';

@Component({
  selector: 'app-customer-list-page',
  imports: [FormsModule, RouterLink, HasPermissionDirective],
  templateUrl: './customer-list-page.component.html',
  styleUrl: './customer-list-page.component.scss'
})
export class CustomerListPageComponent {
  protected readonly store = inject(CustomersStore);
  protected readonly search = signal('');
  protected readonly customersWritePermission = AppPermissions.customersWrite;

  constructor() {
    this.store.load();
  }

  protected searchCustomers(): void {
    this.store.searchFor(this.search());
  }

  protected clearSearch(): void {
    this.search.set('');
    this.store.searchFor('');
  }
}

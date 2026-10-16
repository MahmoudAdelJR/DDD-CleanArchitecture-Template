import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppPermissions } from '../../../core/authorization/app-permissions';
import { HasPermissionDirective } from '../../../core/authorization/has-permission.directive';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import { CustomersStore } from '../customers.store';

@Component({
  selector: 'app-customer-list-page',
  imports: [
    FormsModule,
    RouterLink,
    HasPermissionDirective,
    TranslatePipe,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent
  ],
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

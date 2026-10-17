import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppPermissions } from '../../../core/authorization/app-permissions';
import { HasPermissionDirective } from '../../../core/authorization/has-permission.directive';
import { AppDatePipe } from '../../../shared/dates/app-date.pipe';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import type { CustomerDetails } from '../data-access/customer.models';
import { CUSTOMER_REPOSITORY, CustomerNotFoundError } from '../data-access/customer.repository';

type DetailStatus = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  selector: 'app-customer-detail-page',
  imports: [RouterLink, HasPermissionDirective, AppDatePipe, TranslatePipe, PageHeaderComponent],
  templateUrl: './customer-detail-page.component.html',
  styleUrl: './customer-detail-page.component.scss',
})
export class CustomerDetailPageComponent {
  private readonly repository = inject(CUSTOMER_REPOSITORY);
  private readonly route = inject(ActivatedRoute);

  protected readonly status = signal<DetailStatus>('loading');
  protected readonly customer = signal<CustomerDetails | null>(null);
  protected readonly customersWritePermission = AppPermissions.customersWrite;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      void this.load(id);
    } else {
      this.status.set('error');
    }
  }

  private async load(id: string): Promise<void> {
    try {
      this.customer.set(await this.repository.findById(id));
      this.status.set('ready');
    } catch (error) {
      this.status.set(error instanceof CustomerNotFoundError ? 'not-found' : 'error');
    }
  }
}

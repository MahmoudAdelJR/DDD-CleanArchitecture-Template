import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import type { CustomerDetails } from '../data-access/customer.models';
import { CUSTOMER_REPOSITORY, CustomerNotFoundError } from '../data-access/customer.repository';

type DetailStatus = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  selector: 'app-customer-detail-page',
  imports: [RouterLink, DateFormatPipe],
  templateUrl: './customer-detail-page.component.html',
  styleUrl: './customer-detail-page.component.scss'
})
export class CustomerDetailPageComponent {
  private readonly repository = inject(CUSTOMER_REPOSITORY);
  private readonly route = inject(ActivatedRoute);

  protected readonly status = signal<DetailStatus>('loading');
  protected readonly customer = signal<CustomerDetails | null>(null);

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

import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { BaseHttpService } from '../../../core/services/base-http.service';
import { PagedList } from '../../../shared/models/paged-list.model';
import type { CustomerDetails, CustomerSearch, CustomerSummary } from './customer.models';
import { CustomerNotFoundError, CustomerRepository } from './customer.repository';

/**
 * Real-backend data access for the customers slice. Swap it into
 * `customers.routes.ts` (CUSTOMER_REPOSITORY) to go from the in-memory fake
 * to HTTP without touching pages or stores; enable AppConfig.mockApi during
 * development to exercise it against the dev fixtures.
 */
@Injectable()
export class CustomerHttpRepository extends BaseHttpService implements CustomerRepository {
  private readonly config = inject(APP_CONFIG);

  private customersUrl(path = ''): string {
    return `${this.config.apiBaseUrl}/customers${path}`;
  }

  async search(query: CustomerSearch): Promise<PagedList<CustomerSummary>> {
    return firstValueFrom(
      this.get<PagedList<CustomerSummary>>(this.customersUrl(), {
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
      }),
    );
  }

  async findById(id: string): Promise<CustomerDetails> {
    try {
      return await firstValueFrom(this.get<CustomerDetails>(this.customersUrl(`/${id}`)));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        throw new CustomerNotFoundError(id);
      }
      throw error;
    }
  }
}

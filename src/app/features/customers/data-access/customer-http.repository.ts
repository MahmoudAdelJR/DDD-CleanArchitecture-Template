import { HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { isApiError } from '../../../core/http/api-error';
import { SUPPRESS_GLOBAL_ERROR } from '../../../core/http/http-context';
import { BaseHttpService } from '../../../core/services/base-http.service';
import { PagedList } from '../../../shared/models/paged-list.model';
import type {
  CustomerDetails,
  CustomerInput,
  CustomerSearch,
  CustomerSummary,
} from './customer.models';
import {
  CustomerConflictError,
  CustomerNotFoundError,
  CustomerRepository,
} from './customer.repository';

/**
 * Real-backend data access for the customers slice. Swap it into
 * `customers.routes.ts` (CUSTOMER_REPOSITORY) to go from the in-memory fake
 * to HTTP without touching pages or stores; enable AppConfig.mockApi during
 * development to exercise it against the dev fixtures.
 *
 * Writes run with SUPPRESS_GLOBAL_ERROR so the form owns its error surface
 * (field-level validation + an inline banner) instead of also raising a toast.
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
      // The global error interceptor rethrows ApiError, not HttpErrorResponse.
      if (isApiError(error) && error.status === 404) {
        throw new CustomerNotFoundError(id);
      }
      throw error;
    }
  }

  async create(input: CustomerInput): Promise<CustomerDetails> {
    try {
      return await firstValueFrom(
        this.post<CustomerDetails>(this.customersUrl(), input, undefined, writeContext()),
      );
    } catch (error) {
      throw mapWriteError(error, null);
    }
  }

  async update(id: string, input: CustomerInput): Promise<CustomerDetails> {
    try {
      return await firstValueFrom(
        this.put<CustomerDetails>(this.customersUrl(`/${id}`), input, writeContext()),
      );
    } catch (error) {
      throw mapWriteError(error, id);
    }
  }
}

function writeContext(): HttpContext {
  return new HttpContext().set(SUPPRESS_GLOBAL_ERROR, true);
}

function mapWriteError(error: unknown, id: string | null): unknown {
  if (isApiError(error)) {
    if (id && error.status === 404) {
      return new CustomerNotFoundError(id);
    }
    if (error.status === 409) {
      return new CustomerConflictError(error.message);
    }
  }
  return error;
}

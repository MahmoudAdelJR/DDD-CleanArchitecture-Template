import { inject, Injectable, signal } from '@angular/core';
import { PagedList } from '../../shared/models/paged-list.model';
import type { CustomerSummary } from './data-access/customer.models';
import { CUSTOMER_REPOSITORY } from './data-access/customer.repository';

export type ListStatus = 'loading' | 'ready' | 'error';

export interface CustomerListState {
  status: ListStatus;
  search: string;
  page: number;
  pageSize: number;
  result: PagedList<CustomerSummary> | null;
  error: string | null;
}

@Injectable()
export class CustomersStore {
  private readonly repository = inject(CUSTOMER_REPOSITORY);

  readonly state = signal<CustomerListState>({
    status: 'loading',
    search: '',
    page: 1,
    pageSize: 5,
    result: null,
    error: null,
  });

  load(): void {
    const current = this.state();
    void this.fetch({ search: current.search, page: current.page });
  }

  searchFor(term: string): void {
    void this.fetch({ search: term, page: 1 });
  }

  goToPage(page: number): void {
    const current = this.state();
    void this.fetch({ search: current.search, page });
  }

  private async fetch(query: { search: string; page: number }): Promise<void> {
    const current = this.state();
    this.state.update((state) => ({ ...state, status: 'loading', error: null }));

    try {
      const result = await this.repository.search({ ...query, pageSize: current.pageSize });
      this.state.set({
        status: 'ready',
        search: query.search,
        page: result.pageNumber,
        pageSize: current.pageSize,
        result,
        error: null,
      });
    } catch {
      this.state.update((state) => ({
        ...state,
        status: 'error',
        error: 'The customers could not be loaded. Please try again.',
      }));
    }
  }
}

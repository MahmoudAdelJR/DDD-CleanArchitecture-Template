export interface PagedList<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface SortQuery {
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface SearchQuery {
  search?: string;
}
export type CustomerStatus = 'active' | 'inactive';

export interface CustomerSummary {
  id: string;
  company: string;
  contactName: string;
  email: string;
  city: string;
  status: CustomerStatus;
  createdAt: string;
}

export interface CustomerDetails extends CustomerSummary {
  notes: string;
}

export interface CustomerSearch {
  search: string;
  page: number;
  pageSize: number;
}

/**
 * Command model for creating or updating a customer. Owned by this slice: the
 * server transport shape and the reactive-form value both map onto it.
 */
export interface CustomerInput {
  company: string;
  contactName: string;
  email: string;
  city: string;
  status: CustomerStatus;
  notes: string;
}

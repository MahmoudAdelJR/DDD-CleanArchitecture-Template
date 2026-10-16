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

import { PagedList } from '../shared/models/paged-list.model';

/**
 * Dev fixtures for the mock API interceptor. Plain JSON-shaped data only —
 * importing feature internals from dev tooling is blocked by the lint zones.
 * The composition root (app.config.ts) is the sole consumer.
 */
export interface MockCustomer {
  id: string;
  company: string;
  contactName: string;
  email: string;
  city: string;
  status: 'active' | 'inactive';
  createdAt: string;
  notes: string;
}

const CUSTOMERS: MockCustomer[] = [
  {
    id: 'c1',
    company: 'Acme Industries',
    contactName: 'Wile E. Coyote',
    email: 'wile@acme.example',
    city: 'San Diego',
    status: 'active',
    createdAt: '2024-01-12',
    notes: 'Road-runner acquisition program.',
  },
  {
    id: 'c2',
    company: 'Globex Corporation',
    contactName: 'Hank Scorpio',
    email: 'hank@globex.example',
    city: 'Bedrock',
    status: 'active',
    createdAt: '2024-02-03',
    notes: 'Interested in the flying car pilot.',
  },
  {
    id: 'c3',
    company: 'Initech',
    contactName: 'Peter Gibbons',
    email: 'peter@initech.example',
    city: 'Austin',
    status: 'inactive',
    createdAt: '2023-11-21',
    notes: 'Contract expired after the TPS rewrite.',
  },
  {
    id: 'c4',
    company: 'Umbrella Logistics',
    contactName: 'Alice Park',
    email: 'alice@umbrella.example',
    city: 'Raccoon City',
    status: 'active',
    createdAt: '2023-08-30',
    notes: 'Cold-chain specialists.',
  },
  {
    id: 'c5',
    company: 'Stark Manufacturing',
    contactName: 'Pepper Potts',
    email: 'pepper@stark.example',
    city: 'New York',
    status: 'active',
    createdAt: '2025-03-15',
    notes: 'Premium tier account.',
  },
];

export function mockCustomerSearch(
  params: URLSearchParams,
): PagedList<Omit<MockCustomer, 'notes'>> {
  const search = (params.get('search') ?? '').trim().toLowerCase();
  const page = Number(params.get('page') ?? '1');
  const pageSize = Number(params.get('pageSize') ?? '5');

  const filtered = search
    ? CUSTOMERS.filter((customer) =>
        [customer.company, customer.contactName, customer.email, customer.city]
          .join(' ')
          .toLowerCase()
          .includes(search),
      )
    : CUSTOMERS;

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const resolvedPage = Math.min(Math.max(1, Number.isNaN(page) ? 1 : page), totalPages);
  const start = (resolvedPage - 1) * pageSize;

  const items = filtered.slice(start, start + pageSize).map(({ notes: _notes, ...rest }) => rest);

  return {
    items,
    pageNumber: resolvedPage,
    pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: resolvedPage > 1,
    hasNextPage: resolvedPage < totalPages,
  };
}

export function mockCustomerDetail(id: string): MockCustomer | null {
  return CUSTOMERS.find((customer) => customer.id === id) ?? null;
}

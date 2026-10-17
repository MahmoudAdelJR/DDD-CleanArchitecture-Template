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

/** Envelope returned to the interceptor; >=400 becomes an HttpErrorResponse. */
export interface MockApiResult {
  status: number;
  body: unknown;
}

function createSeed(): MockCustomer[] {
  return [
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
}

let customers: MockCustomer[] = createSeed();
let nextSequence = customers.length + 1;

/** Restores the seed data between specs. */
export function resetMockCustomers(): void {
  customers = createSeed();
  nextSequence = customers.length + 1;
}

export function mockCustomerSearch(
  params: URLSearchParams,
): PagedList<Omit<MockCustomer, 'notes'>> {
  const search = (params.get('search') ?? '').trim().toLowerCase();
  const page = Number(params.get('page') ?? '1');
  const pageSize = Number(params.get('pageSize') ?? '5');

  const filtered = search
    ? customers.filter((customer) =>
        [customer.company, customer.contactName, customer.email, customer.city]
          .join(' ')
          .toLowerCase()
          .includes(search),
      )
    : customers;

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
  return customers.find((customer) => customer.id === id) ?? null;
}

export function mockCustomerCreate(body: unknown): MockApiResult {
  const candidate = toCandidate(body);
  const errors = validate(candidate);
  if (errors) {
    return validationProblem(errors);
  }

  const conflict = findEmailConflict(candidate.email, null);
  if (conflict) {
    return conflictProblem(candidate.email);
  }

  const created: MockCustomer = {
    id: `c${nextSequence++}`,
    ...candidate,
    createdAt: today(),
  };
  customers = [created, ...customers];
  return { status: 201, body: created };
}

export function mockCustomerUpdate(id: string, body: unknown): MockApiResult {
  if (!mockCustomerDetail(id)) {
    return notFoundProblem(id);
  }

  const candidate = toCandidate(body);
  const errors = validate(candidate);
  if (errors) {
    return validationProblem(errors);
  }

  const conflict = findEmailConflict(candidate.email, id);
  if (conflict) {
    return conflictProblem(candidate.email);
  }

  const updated = { ...mockCustomerDetail(id)!, ...candidate };
  customers = customers.map((customer) => (customer.id === id ? updated : customer));
  return { status: 200, body: updated };
}

type Candidate = Omit<MockCustomer, 'id' | 'createdAt'>;

function toCandidate(body: unknown): Candidate {
  const record = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const str = (key: string): string => (typeof record[key] === 'string' ? record[key] : '');
  return {
    company: str('company').trim(),
    contactName: str('contactName').trim(),
    email: str('email').trim(),
    city: str('city').trim(),
    status: record['status'] === 'inactive' ? 'inactive' : 'active',
    notes: str('notes').trim(),
  };
}

function validate(candidate: Candidate): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};
  if (!candidate.company) errors['company'] = ['Company is required.'];
  if (!candidate.contactName) errors['contactName'] = ['Contact name is required.'];
  if (!candidate.email) {
    errors['email'] = ['Email is required.'];
  } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidate.email)) {
    errors['email'] = ['Enter a valid email address.'];
  }
  if (!candidate.city) errors['city'] = ['City is required.'];
  return Object.keys(errors).length > 0 ? errors : null;
}

function findEmailConflict(email: string, exceptId: string | null): boolean {
  const normalized = email.toLowerCase();
  return customers.some(
    (customer) => customer.id !== exceptId && customer.email.toLowerCase() === normalized,
  );
}

function validationProblem(errors: Record<string, string[]>): MockApiResult {
  return {
    status: 422,
    body: {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.21',
      title: 'Validation failed',
      status: 422,
      errors,
    },
  };
}

function conflictProblem(email: string): MockApiResult {
  return {
    status: 409,
    body: {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.10',
      title: 'Conflict',
      status: 409,
      detail: `A customer with email "${email}" already exists.`,
    },
  };
}

function notFoundProblem(id: string): MockApiResult {
  return {
    status: 404,
    body: {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.5',
      title: 'Not Found',
      status: 404,
      detail: `Customer "${id}" was not found.`,
    },
  };
}

function today(): string {
  const now = new Date();
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

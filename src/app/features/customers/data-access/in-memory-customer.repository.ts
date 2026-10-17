import { Injectable } from '@angular/core';
import { toCalendarDateString } from '../../../shared/dates/calendar-date';
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

function createSeed(): CustomerDetails[] {
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
    {
      id: 'c6',
      company: 'Wayne Enterprises',
      contactName: 'Lucius Fox',
      email: 'lucius@wayne.example',
      city: 'Gotham City',
      status: 'active',
      createdAt: '2025-05-02',
      notes: 'R&D partnership under negotiation.',
    },
    {
      id: 'c7',
      company: 'Soylent Foods',
      contactName: 'Sol Roth',
      email: 'sol@soylent.example',
      city: 'New York',
      status: 'inactive',
      createdAt: '2022-12-01',
      notes: 'Dormant since the product recall.',
    },
    {
      id: 'c8',
      company: 'Cyberdyne Systems',
      contactName: 'Miles Dyson',
      email: 'miles@cyberdyne.example',
      city: 'Los Angeles',
      status: 'active',
      createdAt: '2024-07-19',
      notes: 'Automated fab integration project.',
    },
    {
      id: 'c9',
      company: 'Hooli',
      contactName: 'Gavin Belson',
      email: 'gavin@hooli.example',
      city: 'Palo Alto',
      status: 'active',
      createdAt: '2024-09-08',
      notes: 'Magic Eight ball pilot on hold.',
    },
  ];
}

/**
 * Module-level store so writes made through one route-scoped instance are
 * visible after navigating to a route that provisions a fresh instance. It is
 * demo state only and resets on reload; the real adapter persists server-side.
 */
let customers: CustomerDetails[] = createSeed();
let nextSequence = customers.length + 1;

/** Restores the seed data. For tests and demo resets only. */
export function resetInMemoryCustomers(): void {
  customers = createSeed();
  nextSequence = customers.length + 1;
}

const LATENCY_MS = 250;

@Injectable()
export class InMemoryCustomerRepository implements CustomerRepository {
  async search(query: CustomerSearch): Promise<PagedList<CustomerSummary>> {
    await this.simulateLatency();

    const term = query.search.trim().toLowerCase();
    const filtered = term
      ? customers.filter((customer) =>
          [customer.company, customer.contactName, customer.email, customer.city]
            .join(' ')
            .toLowerCase()
            .includes(term),
        )
      : customers;

    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / query.pageSize));
    const page = Math.min(Math.max(1, query.page), totalPages);
    const start = (page - 1) * query.pageSize;

    return {
      items: filtered.slice(start, start + query.pageSize).map(toSummary),
      pageNumber: page,
      pageSize: query.pageSize,
      totalCount,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    };
  }

  async findById(id: string): Promise<CustomerDetails> {
    await this.simulateLatency();
    return clone(findOrThrow(id));
  }

  async create(input: CustomerInput): Promise<CustomerDetails> {
    await this.simulateLatency();
    assertEmailAvailable(input.email, null);

    const created: CustomerDetails = {
      id: `c${nextSequence++}`,
      ...normalize(input),
      createdAt: toCalendarDateString(new Date()),
    };
    customers = [created, ...customers];
    return clone(created);
  }

  async update(id: string, input: CustomerInput): Promise<CustomerDetails> {
    await this.simulateLatency();
    const existing = findOrThrow(id);
    assertEmailAvailable(input.email, id);

    const updated: CustomerDetails = { ...existing, ...normalize(input) };
    customers = customers.map((customer) => (customer.id === id ? updated : customer));
    return clone(updated);
  }

  private simulateLatency(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  }
}

function findOrThrow(id: string): CustomerDetails {
  const customer = customers.find((candidate) => candidate.id === id);
  if (!customer) {
    throw new CustomerNotFoundError(id);
  }
  return customer;
}

function assertEmailAvailable(email: string, exceptId: string | null): void {
  const normalized = email.trim().toLowerCase();
  const clash = customers.some(
    (customer) => customer.id !== exceptId && customer.email.toLowerCase() === normalized,
  );
  if (clash) {
    throw new CustomerConflictError(`A customer with email "${email}" already exists.`);
  }
}

function normalize(input: CustomerInput): Omit<CustomerDetails, 'id' | 'createdAt'> {
  return {
    company: input.company.trim(),
    contactName: input.contactName.trim(),
    email: input.email.trim(),
    city: input.city.trim(),
    status: input.status,
    notes: input.notes.trim(),
  };
}

/** Returns a copy so callers cannot mutate the in-memory store by reference. */
function clone(customer: CustomerDetails): CustomerDetails {
  return { ...customer };
}

/** Strips detail-only fields so list responses match the summary contract. */
function toSummary(customer: CustomerDetails): CustomerSummary {
  const { notes: _notes, ...summary } = customer;
  return summary;
}

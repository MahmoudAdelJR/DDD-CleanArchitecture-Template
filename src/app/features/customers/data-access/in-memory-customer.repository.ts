import { Injectable } from '@angular/core';
import { PagedList } from '../../../shared/models/paged-list.model';
import type { CustomerDetails, CustomerSearch, CustomerSummary } from './customer.models';
import { CustomerNotFoundError, CustomerRepository } from './customer.repository';

const CUSTOMERS: CustomerDetails[] = [
  {
    id: 'c1',
    company: 'Acme Industries',
    contactName: 'Wile E. Coyote',
    email: 'wile@acme.example',
    city: 'San Diego',
    status: 'active',
    createdAt: '2024-01-12',
    notes: 'Road-runner acquisition program.'
  },
  {
    id: 'c2',
    company: 'Globex Corporation',
    contactName: 'Hank Scorpio',
    email: 'hank@globex.example',
    city: 'Bedrock',
    status: 'active',
    createdAt: '2024-02-03',
    notes: 'Interested in the flying car pilot.'
  },
  {
    id: 'c3',
    company: 'Initech',
    contactName: 'Peter Gibbons',
    email: 'peter@initech.example',
    city: 'Austin',
    status: 'inactive',
    createdAt: '2023-11-21',
    notes: 'Contract expired after the TPS rewrite.'
  },
  {
    id: 'c4',
    company: 'Umbrella Logistics',
    contactName: 'Alice Park',
    email: 'alice@umbrella.example',
    city: 'Raccoon City',
    status: 'active',
    createdAt: '2023-08-30',
    notes: 'Cold-chain specialists.'
  },
  {
    id: 'c5',
    company: 'Stark Manufacturing',
    contactName: 'Pepper Potts',
    email: 'pepper@stark.example',
    city: 'New York',
    status: 'active',
    createdAt: '2025-03-15',
    notes: 'Premium tier account.'
  },
  {
    id: 'c6',
    company: 'Wayne Enterprises',
    contactName: 'Lucius Fox',
    email: 'lucius@wayne.example',
    city: 'Gotham City',
    status: 'active',
    createdAt: '2025-05-02',
    notes: 'R&D partnership under negotiation.'
  },
  {
    id: 'c7',
    company: 'Soylent Foods',
    contactName: 'Sol Roth',
    email: 'sol@soylent.example',
    city: 'New York',
    status: 'inactive',
    createdAt: '2022-12-01',
    notes: 'Dormant since the product recall.'
  },
  {
    id: 'c8',
    company: 'Cyberdyne Systems',
    contactName: 'Miles Dyson',
    email: 'miles@cyberdyne.example',
    city: 'Los Angeles',
    status: 'active',
    createdAt: '2024-07-19',
    notes: 'Automated fab integration project.'
  },
  {
    id: 'c9',
    company: 'Hooli',
    contactName: 'Gavin Belson',
    email: 'gavin@hooli.example',
    city: 'Palo Alto',
    status: 'active',
    createdAt: '2024-09-08',
    notes: 'Magic Eight ball pilot on hold.'
  }
];

const LATENCY_MS = 250;

@Injectable()
export class InMemoryCustomerRepository implements CustomerRepository {
  async search(query: CustomerSearch): Promise<PagedList<CustomerSummary>> {
    await this.simulateLatency();

    const term = query.search.trim().toLowerCase();
    const filtered = term
      ? CUSTOMERS.filter(customer =>
          [customer.company, customer.contactName, customer.email, customer.city]
            .join(' ')
            .toLowerCase()
            .includes(term)
        )
      : CUSTOMERS;

    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / query.pageSize));
    const page = Math.min(Math.max(1, query.page), totalPages);
    const start = (page - 1) * query.pageSize;

    return {
      items: filtered.slice(start, start + query.pageSize),
      pageNumber: page,
      pageSize: query.pageSize,
      totalCount,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages
    };
  }

  async findById(id: string): Promise<CustomerDetails> {
    await this.simulateLatency();

    const customer = CUSTOMERS.find(candidate => candidate.id === id);
    if (!customer) {
      throw new CustomerNotFoundError(id);
    }

    return customer;
  }

  private simulateLatency(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, LATENCY_MS));
  }
}

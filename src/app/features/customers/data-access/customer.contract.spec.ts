import { InMemoryCustomerRepository } from './in-memory-customer.repository';

/**
 * Transport contract for GET /api/customers and GET /api/customers/{id}.
 * These assertions run against the in-memory adapter today; point the same
 * suite at a real HTTP repository (or generated OpenAPI client output) to
 * guarantee the backend honors the identical contract before cutover.
 */
const CUSTOMER_SUMMARY_KEYS = [
  'id',
  'company',
  'contactName',
  'email',
  'city',
  'status',
  'createdAt',
];

describe('customers API transport contract', () => {
  const repository = new InMemoryCustomerRepository();

  it('GET /customers returns PagedList<CustomerSummary> with exact transport keys', async () => {
    const page = await repository.search({ search: '', page: 1, pageSize: 5 });

    expect(Object.keys(page).sort()).toEqual(
      [
        'items',
        'pageNumber',
        'pageSize',
        'totalCount',
        'totalPages',
        'hasPreviousPage',
        'hasNextPage',
      ].sort(),
    );

    for (const item of page.items) {
      expect(Object.keys(item).sort()).toEqual([...CUSTOMER_SUMMARY_KEYS].sort());
      expect(['active', 'inactive']).toContain(item.status);
      expect(item.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('page metadata stays internally consistent across the whole result set', async () => {
    const first = await repository.search({ search: '', page: 1, pageSize: 5 });
    expect(first.pageNumber).toBe(1);
    expect(first.hasPreviousPage).toBeFalse();
    expect(first.totalPages).toBe(Math.ceil(first.totalCount / first.pageSize));

    let seen = 0;
    const ids = new Set<string>();

    for (let page = 1; page <= first.totalPages; page++) {
      const result = await repository.search({ search: '', page, pageSize: 5 });
      expect(result.pageNumber).toBe(page);
      expect(result.hasPreviousPage).toBe(page > 1);
      expect(result.hasNextPage).toBe(page < result.totalPages);

      for (const item of result.items) {
        expect(ids.has(item.id)).toBeFalse();
        ids.add(item.id);
        seen++;
      }
    }

    expect(seen).toBe(first.totalCount);
  });

  it('out-of-range pages clamp to the last page instead of failing', async () => {
    const result = await repository.search({ search: '', page: 999, pageSize: 5 });

    expect(result.pageNumber).toBe(result.totalPages);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('search narrows totalCount without breaking pagination invariants', async () => {
    const result = await repository.search({ search: 'new york', page: 1, pageSize: 10 });

    expect(result.totalCount).toBe(result.items.length);
    expect(result.totalPages).toBe(1);
    for (const item of result.items) {
      expect(item.city.toLowerCase()).toBe('new york');
    }
  });

  it('GET /customers/{id} returns detail fields extending the summary', async () => {
    const list = await repository.search({ search: '', page: 1, pageSize: 1 });
    const detail = await repository.findById(list.items[0].id);

    for (const key of CUSTOMER_SUMMARY_KEYS) {
      expect(Object.keys(detail)).toContain(key);
    }
    expect(detail).toEqual(jasmine.objectContaining({ notes: jasmine.any(String) }));
  });
});

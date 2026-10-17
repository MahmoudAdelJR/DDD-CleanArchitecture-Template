import type { CustomerInput } from './customer.models';
import {
  InMemoryCustomerRepository,
  resetInMemoryCustomers,
} from './in-memory-customer.repository';
import { CustomerConflictError, CustomerNotFoundError } from './customer.repository';

const NEW_CUSTOMER: CustomerInput = {
  company: 'Wonka Industries',
  contactName: 'Willy Wonka',
  email: 'willy@wonka.example',
  city: 'Chicago',
  status: 'active',
  notes: 'Interested in the golden-ticket loyalty program.',
};

describe('InMemoryCustomerRepository (writes)', () => {
  const repository = new InMemoryCustomerRepository();

  beforeEach(() => resetInMemoryCustomers());

  it('creates a customer with a server-assigned id and calendar date', async () => {
    const created = await repository.create(NEW_CUSTOMER);

    expect(created.id).toBeTruthy();
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(created.company).toBe('Wonka Industries');
  });

  it('makes a created customer visible to the list search', async () => {
    const before = await repository.search({ search: 'wonka', page: 1, pageSize: 50 });
    expect(before.totalCount).toBe(0);

    await repository.create(NEW_CUSTOMER);

    const after = await repository.search({ search: 'wonka', page: 1, pageSize: 50 });
    expect(after.totalCount).toBe(1);
    expect(after.items[0].company).toBe('Wonka Industries');
  });

  it('rejects a duplicate email with CustomerConflictError', async () => {
    await repository.create(NEW_CUSTOMER);

    await expectAsync(
      repository.create({ ...NEW_CUSTOMER, email: 'willy@wonka.example' }),
    ).toBeRejectedWithError(CustomerConflictError);
  });

  it('trims whitespace on every text field', async () => {
    const created = await repository.create({
      ...NEW_CUSTOMER,
      company: '  Wonka Industries  ',
      email: '  willy@wonka.example  ',
      notes: '  hello  ',
    });

    expect(created.company).toBe('Wonka Industries');
    expect(created.email).toBe('willy@wonka.example');
    expect(created.notes).toBe('hello');
  });

  it('updates fields while preserving id and createdAt', async () => {
    const created = await repository.create(NEW_CUSTOMER);

    const updated = await repository.update(created.id, {
      ...NEW_CUSTOMER,
      company: 'Wonka Global',
      status: 'inactive',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.company).toBe('Wonka Global');
    expect(updated.status).toBe('inactive');
  });

  it('rejects updating a customer that does not exist', async () => {
    await expectAsync(repository.update('ghost', NEW_CUSTOMER)).toBeRejectedWithError(
      CustomerNotFoundError,
    );
  });

  it('rejects an update that collides with another customer email', async () => {
    const created = await repository.create(NEW_CUSTOMER);

    await expectAsync(
      repository.update(created.id, { ...NEW_CUSTOMER, email: 'wile@acme.example' }),
    ).toBeRejectedWithError(CustomerConflictError);
  });

  it('does not leak internal state through returned objects', async () => {
    const created = await repository.create(NEW_CUSTOMER);
    created.company = 'Mutated';

    const reloaded = await repository.findById(created.id);
    expect(reloaded.company).toBe('Wonka Industries');
  });

  it('reset restores the seed dataset', async () => {
    await repository.create(NEW_CUSTOMER);
    const grown = await repository.search({ search: '', page: 1, pageSize: 50 });
    expect(grown.totalCount).toBeGreaterThan(9);

    resetInMemoryCustomers();
    const restored = await repository.search({ search: '', page: 1, pageSize: 50 });
    expect(restored.totalCount).toBe(9);
  });
});

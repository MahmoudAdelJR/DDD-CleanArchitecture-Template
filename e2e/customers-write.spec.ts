import { expect, test, type Page } from '@playwright/test';

async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', 'admin@demo.local');
  await page.fill('#password', 'Admin123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/customers$/, { timeout: 10_000 });
}

async function fillCustomer(
  page: Page,
  values: { company: string; contact: string; email: string; city: string },
): Promise<void> {
  await page.fill('#company', values.company);
  await page.fill('#contactName', values.contact);
  await page.fill('#email', values.email);
  await page.fill('#city', values.city);
}

test.describe('customer write workflow', () => {
  test('admin creates a customer and lands on its detail page', async ({ page }) => {
    await signInAsAdmin(page);

    await page.getByRole('link', { name: 'New customer' }).click();
    await expect(page).toHaveURL(/\/customers\/new$/);

    await fillCustomer(page, {
      company: 'Vandelay Industries',
      contact: 'Art Vandelay',
      email: 'art@vandelay.example',
      city: 'Austin',
    });
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL(/\/customers\/[\w-]+$/);
    await expect(page.getByRole('heading', { name: 'Vandelay Industries' })).toBeVisible();
    await expect(page.getByText('Customer created.')).toBeVisible();
  });

  test('admin edits an existing customer and sees the change persisted', async ({ page }) => {
    await signInAsAdmin(page);

    await page.getByRole('link', { name: 'Acme Industries' }).click();
    await expect(page.getByRole('heading', { name: 'Acme Industries' })).toBeVisible();

    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/customers\/[\w-]+\/edit$/);

    await page.fill('#city', 'Phoenix');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Customer updated.')).toBeVisible();
    await expect(page.getByText('Phoenix')).toBeVisible();
  });

  test('a duplicate email is reported as a conflict', async ({ page }) => {
    await signInAsAdmin(page);

    await page.getByRole('link', { name: 'New customer' }).click();
    await fillCustomer(page, {
      company: 'Hooli',
      contact: 'Gavin Belson',
      email: 'wile@acme.example',
      city: 'Palo Alto',
    });
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('alert')).toContainText('already exists');
    await expect(page).toHaveURL(/\/customers\/new$/);
  });

  test('submitting an empty form shows localized field errors', async ({ page }) => {
    await signInAsAdmin(page);

    await page.getByRole('link', { name: 'New customer' }).click();
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('#company-errors')).toContainText('Company is required.');
    await expect(page.locator('#email-errors')).toContainText('Email is required.');
  });

  test('read-only users cannot reach the write routes', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'reader@demo.local');
    await page.fill('#password', 'Reader123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/customers$/);

    await page.goto('/customers/new');
    await expect(page).not.toHaveURL(/\/customers\/new$/);
  });
});

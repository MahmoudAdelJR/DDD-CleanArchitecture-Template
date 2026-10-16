import { expect, test } from '@playwright/test';

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/customers$/, { timeout: 10_000 });
}

test.describe('client-side authorization', () => {
  test('read-only user sees the list but no Manage affordance', async ({ page }) => {
    await signIn(page, 'reader@demo.local', 'Reader123!');

    await expect(page.getByRole('link', { name: 'Acme Industries' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage' })).toHaveCount(0);
  });

  test('read-only user can still open a customer detail', async ({ page }) => {
    await signIn(page, 'reader@demo.local', 'Reader123!');

    await page.getByRole('link', { name: 'Acme Industries' }).click();
    await expect(page.getByRole('heading', { name: 'Acme Industries' })).toBeVisible();
  });

  test('unknown routes render the not-found page', async ({ page }) => {
    await signIn(page, 'reader@demo.local', 'Reader123!');

    await page.goto('/definitely-not-a-page');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});

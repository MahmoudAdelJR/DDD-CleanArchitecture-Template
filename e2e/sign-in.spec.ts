import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('sign-in and session lifecycle', () => {
  test('unauthenticated visit redirects to login preserving the return url', async ({ page }) => {
    await page.goto('/customers');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fcustomers/);
  });

  test('empty form shows localized field errors', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.locator('#email-errors')).toContainText('Email is required.');
    await expect(page.locator('#password-errors')).toContainText('Password is required.');
  });

  test('invalid credentials surface an accessible alert', async ({ page }) => {
    await signIn(page, 'admin@demo.local', 'wrong-password');

    await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.');
    await expect(page).toHaveURL(/\/login/);
  });

  test('valid admin sign-in lands on customers with write affordances', async ({ page }) => {
    await signIn(page, 'admin@demo.local', 'Admin123!');

    await expect(page).toHaveURL(/\/customers$/);
    await expect(page.getByRole('link', { name: 'Acme Industries' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage' }).first()).toBeVisible();
  });

  test('session survives a page reload', async ({ page }) => {
    await signIn(page, 'admin@demo.local', 'Admin123!');
    await expect(page).toHaveURL(/\/customers$/);

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();
    await expect(page.getByText('Ada Admin')).toBeVisible();
  });

  test('return url sends the user back where they wanted to go', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fprofile/);

    await page.fill('#email', 'reader@demo.local');
    await page.fill('#password', 'Reader123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/profile$/);
  });

  test('sign out clears the session', async ({ page }) => {
    await signIn(page, 'admin@demo.local', 'Admin123!');
    await expect(page).toHaveURL(/\/customers$/);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/customers');
    await expect(page).toHaveURL(/\/login/);
  });
});

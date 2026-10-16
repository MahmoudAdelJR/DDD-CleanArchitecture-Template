import { expect, test } from '@playwright/test';

test.describe('localization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@demo.local');
    await page.fill('#password', 'Admin123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/customers$/);
  });

  test('switching to Français translates the chrome and persists across reload', async ({
    page,
  }) => {
    await page.getByLabel('Language').selectOption('fr');

    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('pagination message interpolates locale parameters', async ({ page }) => {
    await page.getByLabel('Language').selectOption('fr');

    await expect(page.getByText('Page 1 sur 2')).toBeVisible();
  });
});

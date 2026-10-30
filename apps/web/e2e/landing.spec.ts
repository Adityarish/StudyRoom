import { expect, test } from '@playwright/test';
test('landing page is usable on desktop and mobile', async ({ page }) => { await page.goto('/'); await expect(page.getByRole('heading', { name:/Focus better/i })).toBeVisible(); await expect(page.getByLabel(/Invitation link/i)).toBeVisible(); await expect(page.getByText('No sign-up')).toBeVisible(); });

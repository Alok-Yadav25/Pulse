import { test, expect } from '@playwright/test';

test('landing page introduces Pulse and opens the dashboard', async ({ page }, testInfo) => {
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: /Big on signals/ })).toBeVisible();
  await expect(page.locator('.landing-hero > div').first()).toHaveCSS('opacity', '1');
  await page.screenshot({ path: testInfo.outputPath('landing.png'), fullPage: true });
  await page.getByRole('link', { name: 'Open dashboard' }).click();
  await expect(page.getByRole('heading', { name: /A good day to be online/ })).toBeVisible();
  await page.goto('/status/acme');
  await expect(page.getByRole('heading', { name: 'Keeping you in the loop.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Some systems are a little slow.' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('status.png'), fullPage: true });
});

test('demo dashboard is labeled and its range and search work', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByText('Demo workspace', { exact: true })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Production API');
  await expect(page.getByRole('img', { name: /Sample p95 response times/ })).toBeVisible();
  expect(await page.evaluate(() => window.innerWidth)).toBe(page.viewportSize()?.width);
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: '7d', exact: true }).click();
  await expect(page.getByRole('button', { name: '7d', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('158,624', { exact: true })).toBeVisible();
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: /Search anything/ }).click();
  await page.getByPlaceholder('Where would you like to go?').fill('Documentation');
  await page.getByRole('option', { name: 'Documentation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Documentation', exact: true })).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('button', { name: /Daylight/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('table')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('dashboard-light.png'), fullPage: true });
});

test('new local monitor survives reload and can be deleted', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add monitor', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Monitor name').fill('My test site');
  await dialog.getByLabel('Website URL').fill('https://example.com');
  if (testInfo.project.name === 'mobile') {
    expect(await page.evaluate(() => window.innerWidth)).toBe(page.viewportSize()?.width);
    await page.screenshot({ path: testInfo.outputPath('add-dialog.png') });
  }
  await dialog.getByRole('button', { name: 'Add monitor', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('My test site');
  await page.reload();
  await page.getByRole('row').filter({ hasText: 'My test site' }).getByRole('link').first().click();
  await expect(page.getByRole('heading', { name: 'Ready for its first heartbeat.' })).toBeVisible();
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Delete local monitor' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete monitor', exact: true }).click();
  await expect(page.getByRole('table')).not.toContainText('My test site');
});

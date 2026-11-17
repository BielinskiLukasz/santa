import { expect, test } from '@playwright/test';

test('strona startowa ładuje się i umożliwia przejście do opisu', async ({ page }) => {
  await page.goto('/');
  expect(
    await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
  ).toBe(false);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Zwierzęta');
  await page.getByRole('link', { name: 'Poznaj projekt' }).click();
  await expect(page).toHaveURL(/#projekt$/);
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

  const pauseMotion = page.getByRole('button', { name: 'Zatrzymaj animacje', exact: true });
  await expect(pauseMotion).toHaveAttribute('aria-pressed', 'false');
  await pauseMotion.click();

  const resumeMotion = page.getByRole('button', { name: 'Włącz animacje', exact: true });
  await expect(resumeMotion).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveClass(/\bmotion-off\b/);

  await resumeMotion.click();
  await expect(pauseMotion).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('html')).not.toHaveClass(/\bmotion-off\b/);
});
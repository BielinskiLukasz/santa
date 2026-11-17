import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('strona respektuje systemowe ograniczenie animacji', async ({ page }) => {
  await page.goto('/');
  expect(
    await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
  ).toBe(true);
  const motion = page.getByRole('button', { name: 'Ruch ograniczony w ustawieniach systemu' });
  await expect(motion).toBeDisabled();
  await expect(motion).toHaveAttribute('aria-pressed', 'true');
});
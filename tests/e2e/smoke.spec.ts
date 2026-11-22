import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const PASSWORD = 'haslo-testowe-123';

async function setupPassword(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ustaw hasło' })).toBeVisible();
  await page.getByLabel('Hasło (min. 8 znaków)').fill(PASSWORD);
  await page.getByLabel('Powtórz hasło').fill(PASSWORD);
  await page.getByRole('button', { name: 'Zapisz hasło' }).click();
  await expect(page.getByRole('heading', { name: 'Strefa admina' })).toBeVisible();
}

async function addParticipants(page: Page, count: number) {
  for (let index = 0; index < count; index += 1) {
    await page.getByRole('button', { name: 'Dodaj uczestnika' }).click();
  }
  const names = page.getByPlaceholder('Imię');
  await expect(names).toHaveCount(count);
  for (let index = 0; index < count; index += 1) {
    await names.nth(index).fill(`Osoba ${index + 1}`);
  }
  await page.getByRole('button', { name: 'Wylosuj zwierzęta' }).click();
}

test('konfiguracja wydarzenia przeżywa odświeżenie po haśle', async ({ page }) => {
  await setupPassword(page);
  await addParticipants(page, 7);
  await page.getByRole('button', { name: 'Zapisz konfigurację' }).click();
  await expect(page.getByText('Zapisano konfigurację.')).toBeVisible();
  const approve = page.getByRole('button', { name: 'Zatwierdź i zacznij' });
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect(page.getByRole('heading', { name: 'Wspólny budżet' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Odblokuj wydarzenie' })).toBeVisible();
  await page.getByLabel('Hasło operatora').fill(PASSWORD);
  await page.getByRole('button', { name: 'Odblokuj', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Wspólny budżet' })).toBeVisible();
});

test('po zamknięciu strefy admina na ekranie nie ma listy reguł', async ({ page }) => {
  await setupPassword(page);
  await addParticipants(page, 7);

  const rules = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Zakazy' }) });
  await rules.locator('select').nth(0).selectOption({ index: 1 });
  await rules.locator('select').nth(1).selectOption({ index: 2 });
  await rules.getByRole('button', { name: 'Dodaj' }).first().click();
  await expect(rules.locator('li')).toHaveCount(1);

  await page.getByRole('button', { name: 'Zapisz konfigurację' }).click();
  await page.getByRole('button', { name: 'Zamknij strefę' }).click();

  await expect(page.getByRole('heading', { name: 'Strefa admina' })).toHaveCount(0);
  await expect(page.getByText('Pary (zakaz w obie strony)')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Osoba 1↔Osoba 2');
});

test('utracone hasło nie blokuje resetu całości po wpisaniu RESET', async ({ page }) => {
  await setupPassword(page);
  await page.getByRole('button', { name: 'Zamknij strefę' }).click();
  await page.getByRole('button', { name: 'Zablokuj aplikację' }).click();
  await expect(page.getByRole('heading', { name: 'Odblokuj wydarzenie' })).toBeVisible();

  await page.getByRole('button', { name: 'Nie pamiętasz hasła? Reset całości' }).click();
  const confirm = page.getByLabel('Aby potwierdzić, wpisz RESET');
  await confirm.fill('RESET');
  await page.getByRole('button', { name: 'Usuń wszystko' }).click();
  await expect(page.getByRole('heading', { name: 'Ustaw hasło' })).toBeVisible();
});

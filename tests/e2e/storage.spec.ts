import { expect, test } from '@playwright/test';

test('WebCrypto i localStorage odtwarzają stan bez ponownego ujawnienia', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const enginePath: string = '/src/engine/index.ts';
    const statePath: string = '/src/state/index.ts';
    const storagePath: string = '/src/storage/index.ts';
    const engine = await import(enginePath);
    const state = await import(statePath);
    const storage = await import(storagePath);
    const store = new storage.SecureEventStore(window.localStorage, window.crypto);
    const password = 'haslo-testowe';

    await store.initialize(password, state.createInitialState(2026));
    await store.dispatch({
      type: 'CONFIGURE',
      configuration: {
        participants: Array.from({ length: 7 }, (_, index) => ({
          id: `p${index}`,
          name: `Fikcyjna Osoba ${index}`,
          animal: `animal-${index}`,
        })),
        couples: [],
        previousDraws: [],
        manualRestrictions: [],
        currency: 'PLN',
        budgetRange: { min: 10, max: 2000 },
        adminPreviewEnabled: false,
      },
    });
    await store.dispatch({ type: 'START_BUDGET' });
    await store.dispatch({ type: 'SET_BUDGET', amount: 101 });
    await store.dispatch({ type: 'START_DRAWING' });
    await store.draw('p0', engine.createSeededRandom(42));

    const raw = window.localStorage.getItem(storage.STORAGE_KEY) ?? '';
    store.lock();
    const reopened = new storage.SecureEventStore(window.localStorage, window.crypto);
    const restored = await reopened.unlock(password);
    const repeat = await reopened.draw('p0', engine.createSeededRandom(42));
    return {
      containsName: raw.includes('Fikcyjna Osoba 0'),
      containsBudgetField: raw.includes('"budget"'),
      revealCompleted: restored.draws[0]?.revealCompleted,
      canRevealAgain: repeat.draw !== null,
    };
  });

  expect(result).toEqual({
    containsName: false,
    containsBudgetField: false,
    revealCompleted: true,
    canRevealAgain: false,
  });
});
import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../../../src/engine';
import { SecureEventStore, STORAGE_KEY } from '../../../src/storage';
import { MemoryStorage, prepareDrawing } from './fixtures';

function controlledCrypto() {
  let pauseNext = false;
  let notifyStarted: (() => void) | undefined;
  let resume: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { notifyStarted = () => resolve(); });
  const gate = new Promise<void>((resolve) => { resume = () => resolve(); });
  const subtle = new Proxy(globalThis.crypto.subtle, {
    get(target, property) {
      if (property === 'encrypt') {
        return async (...args: Parameters<SubtleCrypto['encrypt']>) => {
          if (pauseNext) {
            pauseNext = false;
            notifyStarted?.();
            await gate;
          }
          return target.encrypt(...args);
        };
      }
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const runtime = new Proxy(globalThis.crypto, {
    get(target, property) {
      if (property === 'subtle') return subtle;
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return {
    runtime,
    started,
    pause: () => { pauseNext = true; },
    release: () => {
      if (!resume) throw new Error('Brak blokady testowej.');
      resume();
    },
  };
}

describe('Przerwanie operacji zapisu', () => {
  it('reset nie pozwala późniejszemu szyfrowaniu odtworzyć usuniętego zapisu', async () => {
    const storage = new MemoryStorage();
    const control = controlledCrypto();
    const store = new SecureEventStore(storage, control.runtime);
    await prepareDrawing(store);
    control.pause();
    const drawing = store.draw('p0', createSeededRandom(21));
    const rejected = expect(drawing).rejects.toMatchObject({ code: 'OPERATION_CANCELLED' });
    await control.started;
    store.resetAll('RESET');
    control.release();
    await rejected;
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(store.isUnlocked()).toBe(false);
  }, 30_000);

  it('ukrywa wynik, gdy sesja kończy się podczas zapisu losowania', async () => {
    const storage = new MemoryStorage();
    const control = controlledCrypto();
    const store = new SecureEventStore(storage, control.runtime);
    await prepareDrawing(store);
    control.pause();
    const drawing = store.draw('p0', createSeededRandom(22));
    await control.started;
    const closing = store.dispatch({ type: 'COMPLETE_REVEAL', giverId: 'p0' });
    control.release();
    expect((await drawing).draw).toBeNull();
    expect((await closing).draws[0]?.revealCompleted).toBe(true);
    expect((await store.draw('p0', () => 0)).draw).toBeNull();
  }, 30_000);
});
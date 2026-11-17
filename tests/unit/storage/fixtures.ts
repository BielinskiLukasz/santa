import { createInitialState } from '../../../src/state';
import { SecureEventStore } from '../../../src/storage';
import type { StorageAdapter } from '../../../src/storage';
import { configuration } from '../state/fixtures';

export const PASSWORD = 'testowe-haslo';

export class MemoryStorage implements StorageAdapter {
  readonly values = new Map<string, string>();
  failWrites = false;
  failRemovals = false;
  failRemovalKey: string | null = null;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('Storage unavailable');
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    if (this.failRemovals || this.failRemovalKey === key) throw new Error('Storage unavailable');
    this.values.delete(key);
  }
}

export async function prepareDrawing(store: SecureEventStore): Promise<void> {
  await store.initialize(PASSWORD, createInitialState(2026));
  await store.dispatch({ type: 'CONFIGURE', configuration: configuration() });
  await store.dispatch({ type: 'START_BUDGET' });
  await store.dispatch({ type: 'SET_BUDGET', amount: 101 });
  await store.dispatch({ type: 'START_DRAWING' });
}
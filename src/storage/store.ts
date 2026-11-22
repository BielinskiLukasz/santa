import { drawFor } from '../engine';
import type { Draw, Random } from '../engine';
import {
  assertAppState,
  completeInterruptedReveals,
  CURRENT_SCHEMA_VERSION,
  migrateState,
  reduceAppState,
  StateError,
} from '../state';
import type { AppAction, AppState, StateMigrations } from '../state';
import {
  calibratePbkdf2Iterations,
  decodeBase64,
  decryptEnvelope,
  derivePasswordKey,
  encryptState,
  envelopeIterations,
  parseEnvelope,
  PBKDF2_ITERATIONS,
  randomSalt,
  StorageError,
  validateNewPassword,
} from './crypto';

export const STORAGE_KEY = 'zwierzeta-losuja:state';
export const MUTED_KEY = 'zwierzeta-losuja:muted';

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface OpenedState {
  readonly state: AppState;
  readonly key: CryptoKey;
  readonly salt: Uint8Array<ArrayBuffer>;
  readonly version: number;
  readonly iterations: number;
}

export interface InitializeStoreOptions {
  // Explicit PBKDF2 iteration count for the new save (stored in the envelope).
  readonly iterations?: number;
  // Or measure this device first and pick a count targeting ~1 s (never below 600 000).
  readonly calibrate?: boolean;
}

function copyState(state: AppState): AppState {
  try {
    const copy: unknown = JSON.parse(JSON.stringify(state));
    assertAppState(copy);
    return copy;
  } catch {
    throw new StorageError('INVALID_STATE', 'Nieprawidłowy stan wydarzenia.');
  }
}

export class SecureEventStore {
  private key: CryptoKey | null = null;
  private salt: Uint8Array<ArrayBuffer> | null = null;
  private iterations = PBKDF2_ITERATIONS;
  private current: AppState | null = null;
  private persisted: string | null = null;
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  private readonly closedReveals = new Set<string>();
  private readonly pendingDraws = new Map<string, number>();

  constructor(
    private readonly storage: StorageAdapter,
    private readonly runtime: Crypto,
    private readonly migrations: StateMigrations = {},
  ) {}

  private read(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch {
      throw new StorageError('PERSISTENCE_FAILED', 'Nie można odczytać zapisu.');
    }
  }

  private write(key: string, value: string): void {
    try {
      this.storage.setItem(key, value);
    } catch {
      throw new StorageError('PERSISTENCE_FAILED', 'Nie można zapisać danych.');
    }
  }

  private remove(key: string): void {
    try {
      this.storage.removeItem(key);
    } catch {
      throw new StorageError('PERSISTENCE_FAILED', 'Nie można usunąć zapisu.');
    }
  }

  private checkGeneration(generation: number): void {
    if (generation !== this.generation) {
      throw new StorageError('OPERATION_CANCELLED', 'Sesja została zamknięta.');
    }
  }

  // Serializing writes prevents a slower encryption from overwriting a newer state.
  private enqueue<T>(operation: (generation: number) => Promise<T>): Promise<T> {
    const generation = this.generation;
    const result = this.queue.then(() => {
      this.checkGeneration(generation);
      return operation(generation);
    });
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private unlocked(): { key: CryptoKey; salt: Uint8Array<ArrayBuffer>; iterations: number; state: AppState; raw: string } {
    if (!this.key || !this.salt || !this.current || this.persisted === null) {
      throw new StorageError('LOCKED', 'Aplikacja jest zablokowana.');
    }
    return { key: this.key, salt: this.salt, iterations: this.iterations, state: this.current, raw: this.persisted };
  }

  private unchanged(expected: string | null): void {
    if (this.read(STORAGE_KEY) !== expected) {
      throw new StorageError('CONFLICT', 'Zapis zmienił się w innym kontekście. Odblokuj go ponownie.');
    }
  }

  private async open(raw: string, password: string): Promise<OpenedState> {
    const envelope = parseEnvelope(raw);
    const salt = decodeBase64(envelope.salt);
    const iterations = envelopeIterations(envelope);
    const key = await derivePasswordKey(this.runtime, password, salt, iterations);
    const payload = await decryptEnvelope(this.runtime, key, envelope);
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload) ||
      (payload as Record<string, unknown>).schemaVersion !== envelope.version) {
      throw new StorageError('INVALID_STATE', 'Nieprawidłowy stan wydarzenia.');
    }
    try {
      return { state: migrateState(payload, this.migrations), key, salt, version: envelope.version, iterations };
    } catch (error) {
      if (error instanceof StateError && error.code === 'UNSUPPORTED_VERSION') {
        throw new StorageError('UNSUPPORTED_VERSION', 'Nieobsługiwana wersja zapisu.');
      }
      throw new StorageError('INVALID_STATE', 'Nieprawidłowy stan wydarzenia.');
    }
  }

  private async commit(state: AppState, generation: number): Promise<AppState> {
    const session = this.unlocked();
    const snapshot = copyState(state);
    const encoded = JSON.stringify(await encryptState(this.runtime, session.key, session.salt, snapshot, session.iterations));
    this.checkGeneration(generation);
    this.unchanged(session.raw);
    this.write(STORAGE_KEY, encoded);
    this.persisted = encoded;
    this.current = snapshot;
    return copyState(snapshot);
  }

  private async authenticate(password: string, generation: number): Promise<boolean> {
    const session = this.unlocked();
    this.unchanged(session.raw);
    try {
      await this.open(session.raw, password);
    } catch (error) {
      this.checkGeneration(generation);
      if (error instanceof StorageError && error.code === 'AUTH_FAILED') return false;
      throw error;
    }
    this.checkGeneration(generation);
    this.unchanged(session.raw);
    return true;
  }

  hasSavedState(): boolean {
    return this.read(STORAGE_KEY) !== null;
  }

  isUnlocked(): boolean {
    return this.current !== null;
  }

  getState(): AppState {
    return copyState(this.unlocked().state);
  }

  async initialize(password: string, initialState: AppState, options: InitializeStoreOptions = {}): Promise<AppState> {
    validateNewPassword(password);
    const initial = copyState(initialState);
    if (initial.event.phase !== 'SETUP' || initial.draws.length !== 0) {
      throw new StorageError('INVALID_STATE', 'Nowe wydarzenie musi zaczynać się od konfiguracji.');
    }
    return this.enqueue(async (generation) => {
      if (this.read(STORAGE_KEY) !== null) {
        throw new StorageError('ALREADY_INITIALIZED', 'Zapis już istnieje.');
      }
      const iterations = options.iterations ??
        (options.calibrate === true ? await calibratePbkdf2Iterations(this.runtime) : PBKDF2_ITERATIONS);
      const salt = randomSalt(this.runtime);
      const key = await derivePasswordKey(this.runtime, password, salt, iterations);
      const raw = JSON.stringify(await encryptState(this.runtime, key, salt, initial, iterations));
      this.checkGeneration(generation);
      this.unchanged(null);
      this.write(STORAGE_KEY, raw);
      this.key = key;
      this.salt = salt;
      this.iterations = iterations;
      this.current = initial;
      this.persisted = raw;
      this.closedReveals.clear();
      return copyState(initial);
    });
  }

  async unlock(password: string): Promise<AppState> {
    return this.enqueue(async (generation) => {
      if (this.isUnlocked()) throw new StorageError('ALREADY_UNLOCKED', 'Aplikacja jest już odblokowana.');
      const raw = this.read(STORAGE_KEY);
      if (raw === null) throw new StorageError('NOT_INITIALIZED', 'Brak zapisu wydarzenia.');
      const opened = await this.open(raw, password);
      this.checkGeneration(generation);
      this.unchanged(raw);
      const restored = completeInterruptedReveals(opened.state);
      let saved = raw;
      if (restored !== opened.state || opened.version !== CURRENT_SCHEMA_VERSION) {
        saved = JSON.stringify(await encryptState(this.runtime, opened.key, opened.salt, restored, opened.iterations));
        this.checkGeneration(generation);
        this.unchanged(raw);
        this.write(STORAGE_KEY, saved);
      }
      this.key = opened.key;
      this.salt = opened.salt;
      this.iterations = opened.iterations;
      this.current = copyState(restored);
      this.persisted = saved;
      this.closedReveals.clear();
      return copyState(restored);
    });
  }

  lock(): void {
    this.generation++;
    this.key = null;
    this.salt = null;
    this.iterations = PBKDF2_ITERATIONS;
    this.current = null;
    this.persisted = null;
    this.closedReveals.clear();
    this.pendingDraws.clear();
  }

  async dispatch(action: AppAction): Promise<AppState> {
    this.unlocked();
    if (action.type === 'DRAW' || action.type === 'UNDO_LAST_DRAW' || action.type === 'RESET_DRAWING') {
      throw new StorageError('CONFIRM_REQUIRED', 'Użyj odpowiedniej metody zapisu i potwierdzenia.');
    }
    // Hide a closing reveal immediately, even if encryption or persistence later fails.
    if (action.type === 'COMPLETE_REVEAL' && (
      this.pendingDraws.has(action.giverId) ||
      this.current?.draws.some((entry) => entry.giverId === action.giverId && !entry.revealCompleted)
    )) this.closedReveals.add(action.giverId);
    const safeAction = structuredClone(action);
    return this.enqueue(async (generation) => {
      const session = this.unlocked();
      this.unchanged(session.raw);
      const current = session.state;
      const next = reduceAppState(current, safeAction);
      if (next === current) return copyState(current);
      return this.commit(next, generation);
    });
  }

  async draw(giverId: string, random: Random): Promise<{ readonly state: AppState; readonly draw: Draw | null }> {
    this.unlocked();
    const drawGeneration = this.generation;
    this.pendingDraws.set(giverId, (this.pendingDraws.get(giverId) ?? 0) + 1);
    try {
      return await this.enqueue(async (generation) => {
        const session = this.unlocked();
        this.unchanged(session.raw);
        const current = session.state;
        const previous = current.draws.find((entry) => entry.giverId === giverId);
        if (previous) {
          return { state: copyState(current), draw: previous.revealCompleted || this.closedReveals.has(giverId) ? null : { ...previous } };
        }
        if (current.event.phase !== 'DRAWING') {
          throw new StateError('INVALID_PHASE', 'Operacja nie jest dostępna w tej fazie.');
        }
        if (current.draws.some((entry) => !entry.revealCompleted)) {
          throw new StateError('PENDING_REVEAL', 'Najpierw zakończ poprzednią sesję ujawnienia.');
        }
        const selection = drawFor(current, giverId, random).draw;
        const next = reduceAppState(current, { type: 'DRAW', giverId, receiverId: selection.receiverId });
        const saved = await this.commit(next, generation);
        return { state: saved, draw: this.closedReveals.has(giverId) ? null : { ...selection } };
      });
    } finally {
      if (drawGeneration === this.generation) {
        const remaining = (this.pendingDraws.get(giverId) ?? 1) - 1;
        if (remaining > 0) this.pendingDraws.set(giverId, remaining);
        else {
          this.pendingDraws.delete(giverId);
          if (!this.current?.draws.some((entry) => entry.giverId === giverId)) this.closedReveals.delete(giverId);
        }
      }
    }
  }

  async verifyPassword(password: string): Promise<boolean> {
    this.unlocked();
    return this.enqueue((generation) => this.authenticate(password, generation));
  }

  async undoLastDraw(password: string, confirmed: boolean): Promise<AppState> {
    this.unlocked();
    if (confirmed !== true) throw new StorageError('CONFIRM_REQUIRED', 'Cofnięcie wymaga potwierdzenia.');
    return this.enqueue(async (generation) => {
      if (!await this.authenticate(password, generation)) {
        throw new StorageError('AUTH_FAILED', 'Nieprawidłowe hasło lub uszkodzone dane.');
      }
      const current = this.unlocked().state;
      const next = reduceAppState(current, { type: 'UNDO_LAST_DRAW' });
      if (next === current) return copyState(current);
      const giverId = current.draws.at(-1)?.giverId;
      const saved = await this.commit(next, generation);
      if (giverId !== undefined) this.closedReveals.delete(giverId);
      return saved;
    });
  }

  async resetDrawing(password: string, confirmation: string): Promise<AppState> {
    this.unlocked();
    if (confirmation !== 'RESET') throw new StorageError('CONFIRM_REQUIRED', 'Wpisz RESET, aby potwierdzić.');
    return this.enqueue(async (generation) => {
      if (!await this.authenticate(password, generation)) {
        throw new StorageError('AUTH_FAILED', 'Nieprawidłowe hasło lub uszkodzone dane.');
      }
      const current = this.unlocked().state;
      const next = reduceAppState(current, { type: 'RESET_DRAWING' });
      if (next === current) return copyState(current);
      const saved = await this.commit(next, generation);
      this.closedReveals.clear();
      return saved;
    });
  }

  async exportBackup(password: string): Promise<string> {
    this.unlocked();
    return this.enqueue(async (generation) => {
      if (!await this.authenticate(password, generation)) {
        throw new StorageError('AUTH_FAILED', 'Nieprawidłowe hasło lub uszkodzone dane.');
      }
      return this.unlocked().raw;
    });
  }

  async importBackup(raw: string, password: string, confirmed: boolean): Promise<AppState> {
    return this.enqueue(async (generation) => {
      const previous = this.read(STORAGE_KEY);
      if (previous !== null && confirmed !== true) {
        throw new StorageError('CONFIRM_REQUIRED', 'Import wymaga potwierdzenia nadpisania.');
      }
      const opened = await this.open(raw, password);
      const restored = completeInterruptedReveals(opened.state);
      const encoded = JSON.stringify(await encryptState(this.runtime, opened.key, opened.salt, restored, opened.iterations));
      this.checkGeneration(generation);
      this.unchanged(previous);
      this.write(STORAGE_KEY, encoded);
      this.generation++;
      this.key = opened.key;
      this.salt = opened.salt;
      this.iterations = opened.iterations;
      this.current = copyState(restored);
      this.persisted = encoded;
      this.closedReveals.clear();
      this.pendingDraws.clear();
      return copyState(restored);
    });
  }

  resetAll(confirmation: string): void {
    if (confirmation !== 'RESET') throw new StorageError('CONFIRM_REQUIRED', 'Wpisz RESET, aby potwierdzić.');
    this.lock();
    const muted = this.read(MUTED_KEY);
    try {
      this.remove(MUTED_KEY);
      this.remove(STORAGE_KEY);
    } catch (error) {
      // localStorage has no multi-key transaction; restore the non-sensitive setting if possible.
      try {
        if (muted === null) this.remove(MUTED_KEY);
        else this.write(MUTED_KEY, muted);
      } catch {
        // The original storage error remains the actionable failure.
      }
      throw error;
    }
  }

  getMuted(): boolean {
    return this.read(MUTED_KEY) === '1';
  }

  setMuted(muted: boolean): void {
    if (typeof muted !== 'boolean') throw new TypeError('Wyciszenie wymaga wartości logicznej.');
    this.write(MUTED_KEY, muted ? '1' : '0');
  }
}
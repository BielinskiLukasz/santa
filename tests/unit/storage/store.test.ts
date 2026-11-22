import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../../../src/engine';
import { createInitialState } from '../../../src/state';
import { MUTED_KEY, SecureEventStore, STORAGE_KEY } from '../../../src/storage';
import {
  decodeBase64,
  derivePasswordKey,
  encodeBase64,
  MAX_PBKDF2_ITERATIONS,
  MIN_PBKDF2_ITERATIONS,
  parseEnvelope,
  randomSalt,
} from '../../../src/storage/crypto';
import { configuration } from '../state/fixtures';
import { MemoryStorage, PASSWORD, prepareDrawing } from './fixtures';

function saved(storage: MemoryStorage): string {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) throw new Error('Brak zapisu testowego.');
  return raw;
}

describe('Zaszyfrowany zapis', () => {
  it('nie zapisuje danych jawnie i odblokowuje tylko poprawnym hasłem', async () => {
    const storage = new MemoryStorage();
    const store = new SecureEventStore(storage, globalThis.crypto);
    await expect(store.initialize('krótkie', createInitialState(2026))).rejects.toMatchObject({ code: 'PASSWORD_TOO_SHORT' });
    expect(store.hasSavedState()).toBe(false);

    await store.initialize(PASSWORD, createInitialState(2026));
    const first = parseEnvelope(saved(storage));
    const configured = await store.dispatch({ type: 'CONFIGURE', configuration: configuration() });
    const raw = saved(storage);
    const second = parseEnvelope(raw);
    expect(Object.keys(second).sort()).toEqual(['ciphertext', 'iv', 'salt', 'version']);
    expect(second.salt).toBe(first.salt);
    expect(second.iv).not.toBe(first.iv);
    expect(raw).not.toContain('Osoba 0');
    expect(raw).not.toContain('animal-0');
    expect(raw).not.toContain(PASSWORD);
    expect(raw).not.toContain('"budget"');

    store.lock();
    expect(() => store.getState()).toThrow();
    await expect(store.unlock('niepoprawne-haslo')).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    expect(store.isUnlocked()).toBe(false);
    expect(await store.unlock(PASSWORD)).toEqual(configured);
    expect(await store.verifyPassword('niepoprawne-haslo')).toBe(false);
    expect(await store.verifyPassword(PASSWORD)).toBe(true);
  }, 30_000);

  it('odrzuca uszkodzony szyfrogram, zmienione AAD i nieznaną wersję', async () => {
    const storage = new MemoryStorage();
    const store = new SecureEventStore(storage, globalThis.crypto);
    await store.initialize(PASSWORD, createInitialState(2026));
    const original = saved(storage);
    const envelope = parseEnvelope(original);
    const ciphertext = decodeBase64(envelope.ciphertext);
    const firstByte = ciphertext[0];
    if (firstByte === undefined) throw new Error('Brak szyfrogramu.');
    ciphertext[0] = firstByte ^ 1;
    store.lock();

    storage.setItem(STORAGE_KEY, JSON.stringify({ ...envelope, ciphertext: encodeBase64(ciphertext) }));
    await expect(store.unlock(PASSWORD)).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...envelope, version: 0 }));
    await expect(store.unlock(PASSWORD)).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...envelope, version: 99 }));
    await expect(store.unlock(PASSWORD)).rejects.toMatchObject({ code: 'UNSUPPORTED_VERSION' });
    storage.setItem(STORAGE_KEY, 'uszkodzony zapis');
    await expect(store.unlock(PASSWORD)).rejects.toMatchObject({ code: 'INVALID_FORMAT' });
    expect(store.isUnlocked()).toBe(false);
  }, 30_000);

  it('zachowuje kolejność zapisów i nie udostępnia zmiennej kopii stanu', async () => {
    const storage = new MemoryStorage();
    const store = new SecureEventStore(storage, globalThis.crypto);
    await store.initialize(PASSWORD, createInitialState(2026));
    await store.dispatch({ type: 'CONFIGURE', configuration: configuration() });
    await store.dispatch({ type: 'START_BUDGET' });
    const first = store.dispatch({ type: 'SET_BUDGET', amount: 101 });
    const second = store.dispatch({ type: 'SET_BUDGET', amount: 125 });
    const results = await Promise.all([first, second]);
    expect(results[0]?.event.budget).toBe(101);
    expect(results[1]?.event.budget).toBe(125);
    const copy = store.getState() as unknown as { event: { budget: number } };
    copy.event.budget = 999;
    expect(store.getState().event.budget).toBe(125);
  }, 20_000);

  it('nie ujawnia przydziału, jeśli zapis się nie powiedzie', async () => {
    const storage = new MemoryStorage();
    const store = new SecureEventStore(storage, globalThis.crypto);
    await prepareDrawing(store);
    const original = saved(storage);
    storage.failWrites = true;
    await expect(store.draw('p0', createSeededRandom(4))).rejects.toMatchObject({ code: 'PERSISTENCE_FAILED' });
    expect(store.getState().draws).toHaveLength(0);
    expect(saved(storage)).toBe(original);
    storage.failWrites = false;
    expect((await store.draw('p0', createSeededRandom(4))).draw).not.toBeNull();
  }, 20_000);

  it('po odświeżeniu kończy przerwaną sesję przed udostępnieniem stanu', async () => {
    const storage = new MemoryStorage();
    const store = new SecureEventStore(storage, globalThis.crypto);
    await prepareDrawing(store);
    const selected = await store.draw('p0', createSeededRandom(10));
    expect(selected.draw?.revealCompleted).toBe(false);
    const before = saved(storage);
    store.lock();
    const reopened = new SecureEventStore(storage, globalThis.crypto);
    expect(reopened.isUnlocked()).toBe(false);
    const restored = await reopened.unlock(PASSWORD);
    expect(restored.draws[0]?.revealCompleted).toBe(true);
    expect(saved(storage)).not.toBe(before);
    const repeat = await reopened.draw('p0', () => { throw new Error('RNG nie powinno być użyte'); });
    expect(repeat.draw).toBeNull();
  }, 20_000);

  it('nie odblokowuje przerwanego ujawnienia, gdy zapis odzyskiwania się nie powiedzie', async () => {
    const storage = new MemoryStorage();
    const store = new SecureEventStore(storage, globalThis.crypto);
    await prepareDrawing(store);
    await store.draw('p0', createSeededRandom(9));
    store.lock();
    storage.failWrites = true;
    await expect(store.unlock(PASSWORD)).rejects.toMatchObject({ code: 'PERSISTENCE_FAILED' });
    expect(store.isUnlocked()).toBe(false);
    storage.failWrites = false;
    expect((await store.unlock(PASSWORD)).draws[0]?.revealCompleted).toBe(true);
  }, 30_000);

  it('zamyka dostęp do wyniku natychmiast nawet przy błędzie zapisu', async () => {
    const storage = new MemoryStorage();
    const store = new SecureEventStore(storage, globalThis.crypto);
    await prepareDrawing(store);
    expect((await store.draw('p0', createSeededRandom(11))).draw).not.toBeNull();
    storage.failWrites = true;
    await expect(store.dispatch({ type: 'COMPLETE_REVEAL', giverId: 'p0' })).rejects.toMatchObject({ code: 'PERSISTENCE_FAILED' });
    expect((await store.draw('p0', () => 0)).draw).toBeNull();
    storage.failWrites = false;
    expect((await store.dispatch({ type: 'COMPLETE_REVEAL', giverId: 'p0' })).draws[0]?.revealCompleted).toBe(true);
  }, 20_000);

  it('wykrywa zmianę zapisu w innym kontekście', async () => {
    const storage = new MemoryStorage();
    const store = new SecureEventStore(storage, globalThis.crypto);
    await store.initialize(PASSWORD, createInitialState(2026));
    storage.setItem(STORAGE_KEY, 'inny zapis');
    await expect(store.dispatch({ type: 'CONFIGURE', configuration: configuration() })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(store.getState().participants).toHaveLength(0);
    expect(storage.getItem(STORAGE_KEY)).toBe('inny zapis');
  }, 20_000);
});

describe('Kopie, cofanie i resety', () => {
  it('migruje zarejestrowany starszy schemat i ponownie wiąże wersję z AAD', async () => {
    const storage = new MemoryStorage();
    const salt = randomSalt(globalThis.crypto);
    const key = await derivePasswordKey(globalThis.crypto, PASSWORD, salt);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const legacy = { ...createInitialState(2026), schemaVersion: 0 };
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: new Uint8Array(new TextEncoder().encode('zwierzeta-losuja:0')), tagLength: 128 },
      key,
      new Uint8Array(new TextEncoder().encode(JSON.stringify(legacy))),
    );
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: 0,
      salt: encodeBase64(salt),
      iv: encodeBase64(iv),
      ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    }));
    const store = new SecureEventStore(storage, globalThis.crypto, {
      0: (value) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Nieprawidłowy stan.');
        return { ...value, schemaVersion: 1 };
      },
    });
    expect((await store.unlock(PASSWORD)).schemaVersion).toBe(1);
    expect(parseEnvelope(saved(storage)).version).toBe(1);
    store.lock();
    expect((await store.unlock(PASSWORD)).schemaVersion).toBe(1);
  }, 30_000);

  it('importuje kopię po haśle i wymaga potwierdzenia nadpisania', async () => {
    const source = new SecureEventStore(new MemoryStorage(), globalThis.crypto);
    await prepareDrawing(source);
    await source.draw('p0', createSeededRandom(5));
    const backup = await source.exportBackup(PASSWORD);

    const storage = new MemoryStorage();
    const target = new SecureEventStore(storage, globalThis.crypto);
    await expect(target.importBackup(backup, 'niepoprawne-haslo', false)).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    expect(target.hasSavedState()).toBe(false);
    const imported = await target.importBackup(backup, PASSWORD, false);
    expect(imported.draws[0]?.revealCompleted).toBe(true);
    expect((await target.draw('p0', () => 0)).draw).toBeNull();

    const original = saved(storage);
    await expect(target.importBackup(backup, PASSWORD, false)).rejects.toMatchObject({ code: 'CONFIRM_REQUIRED' });
    await expect(target.importBackup(backup, 'niepoprawne-haslo', true)).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    expect(saved(storage)).toBe(original);
    expect((await target.importBackup(backup, PASSWORD, true)).draws[0]?.revealCompleted).toBe(true);
  }, 30_000);

  it('wymaga ponownego hasła i potwierdzenia dla cofnięcia oraz resetu losowania', async () => {
    const storage = new MemoryStorage();
    const store = new SecureEventStore(storage, globalThis.crypto);
    await prepareDrawing(store);
    await store.draw('p0', createSeededRandom(13));
    await store.dispatch({ type: 'COMPLETE_REVEAL', giverId: 'p0' });
    await expect(store.undoLastDraw(PASSWORD, false)).rejects.toMatchObject({ code: 'CONFIRM_REQUIRED' });
    await expect(store.undoLastDraw('niepoprawne-haslo', true)).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    expect((await store.undoLastDraw(PASSWORD, true)).draws).toHaveLength(0);

    await store.draw('p0', createSeededRandom(14));
    await store.dispatch({ type: 'COMPLETE_REVEAL', giverId: 'p0' });
    await expect(store.resetDrawing(PASSWORD, 'nie')).rejects.toMatchObject({ code: 'CONFIRM_REQUIRED' });
    const reset = await store.resetDrawing(PASSWORD, 'RESET');
    expect(reset.draws).toEqual([]);
    expect(reset.event.phase).toBe('BUDGET');
    expect(reset.event.budget).toBe(101);
    expect(reset.participants).toHaveLength(7);
  }, 30_000);

  it('pozwala usunąć całość bez hasła, a wyciszenie trzyma osobno', async () => {
    const storage = new MemoryStorage();
    const store = new SecureEventStore(storage, globalThis.crypto);
    await store.initialize(PASSWORD, createInitialState(2026));
    store.setMuted(true);
    expect(store.getMuted()).toBe(true);
    expect(storage.getItem(MUTED_KEY)).toBe('1');
    store.lock();
    expect(() => store.resetAll('nie')).toThrow();
    expect(store.hasSavedState()).toBe(true);
    store.resetAll('RESET');
    expect(store.hasSavedState()).toBe(false);
    expect(store.getMuted()).toBe(false);
    expect(store.isUnlocked()).toBe(false);
  }, 20_000);

  it('nie kasuje wrażliwego zapisu, jeśli usuwanie ustawień się nie powiedzie', async () => {
    const storage = new MemoryStorage();
    const store = new SecureEventStore(storage, globalThis.crypto);
    await store.initialize(PASSWORD, createInitialState(2026));
    storage.failRemovals = true;
    expect(() => store.resetAll('RESET')).toThrow();
    expect(store.hasSavedState()).toBe(true);
    expect(store.isUnlocked()).toBe(false);
  }, 20_000);

  it('odtwarza wyciszenie, gdy usunięcie zaszyfrowanego zapisu się nie powiedzie', async () => {
    const storage = new MemoryStorage();
    const store = new SecureEventStore(storage, globalThis.crypto);
    await store.initialize(PASSWORD, createInitialState(2026));
    store.setMuted(true);
    storage.failRemovalKey = STORAGE_KEY;
    expect(() => store.resetAll('RESET')).toThrow();
    expect(store.hasSavedState()).toBe(true);
    expect(store.getMuted()).toBe(true);
    expect(store.isUnlocked()).toBe(false);
  }, 20_000);
});

describe('Liczba iteracji klucza', () => {
  it('zapisuje jawną liczbę iteracji i wymaga jej przy każdym odblokowaniu', async () => {
    const storage = new MemoryStorage();
    const store = new SecureEventStore(storage, globalThis.crypto);
    await store.initialize(PASSWORD, createInitialState(2026), { iterations: 900_000 });
    expect(parseEnvelope(saved(storage)).iterations).toBe(900_000);

    // Later commits must keep the calibrated count in the envelope.
    await store.dispatch({ type: 'CONFIGURE', configuration: configuration() });
    expect(parseEnvelope(saved(storage)).iterations).toBe(900_000);

    store.lock();
    await expect(store.unlock('niepoprawne-haslo')).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    expect((await store.unlock(PASSWORD)).participants).toHaveLength(7);

    // Removing the stored count falls back to the default and the key no longer matches.
    store.lock();
    const tampered = JSON.parse(saved(storage)) as Record<string, unknown>;
    delete tampered.iterations;
    storage.setItem(STORAGE_KEY, JSON.stringify(tampered));
    await expect(store.unlock(PASSWORD)).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    expect(store.isUnlocked()).toBe(false);
  }, 30_000);

  it('kalibruje liczbę iteracji przy zakładaniu hasła do zakresu ze specyfikacji', async () => {
    const storage = new MemoryStorage();
    const store = new SecureEventStore(storage, globalThis.crypto);
    await store.initialize(PASSWORD, createInitialState(2026), { calibrate: true });
    const iterations = parseEnvelope(saved(storage)).iterations ?? MIN_PBKDF2_ITERATIONS;
    expect(iterations).toBeGreaterThanOrEqual(MIN_PBKDF2_ITERATIONS);
    expect(iterations).toBeLessThanOrEqual(MAX_PBKDF2_ITERATIONS);
    store.lock();
    expect(await store.unlock(PASSWORD)).toEqual(createInitialState(2026));
  }, 60_000);
});
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../src/state';
import {
  calibratePbkdf2Iterations,
  decodeBase64,
  decryptEnvelope,
  derivePasswordKey,
  encodeBase64,
  encryptState,
  envelopeIterations,
  iterationsForMeasuredDuration,
  MAX_PBKDF2_ITERATIONS,
  MIN_PBKDF2_ITERATIONS,
  parseEnvelope,
  PBKDF2_ITERATIONS,
  randomSalt,
  validateNewPassword,
} from '../../../src/storage/crypto';

describe('PBKDF2 i AES-GCM', () => {
  it('szyfruje stan kluczem niewyciągalnym i używa nowego IV', async () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
    const salt = randomSalt(globalThis.crypto);
    expect(salt).toHaveLength(16);
    const key = await derivePasswordKey(globalThis.crypto, 'testowe-haslo', salt);
    expect(key.extractable).toBe(false);
    const state = createInitialState(2026);
    const first = await encryptState(globalThis.crypto, key, salt, state);
    const second = await encryptState(globalThis.crypto, key, salt, state);
    expect(decodeBase64(first.iv)).toHaveLength(12);
    expect(first.salt).toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(await decryptEnvelope(globalThis.crypto, key, first)).toEqual(state);
  }, 20_000);

  it('odrzuca złe hasło, zmieniony szyfrogram i inną wersję AAD', async () => {
    const salt = randomSalt(globalThis.crypto);
    const key = await derivePasswordKey(globalThis.crypto, 'testowe-haslo', salt);
    const wrongKey = await derivePasswordKey(globalThis.crypto, 'inne-haslo', salt);
    const envelope = await encryptState(globalThis.crypto, key, salt, createInitialState(2026));
    await expect(decryptEnvelope(globalThis.crypto, wrongKey, envelope)).rejects.toMatchObject({ code: 'AUTH_FAILED' });

    const bytes = decodeBase64(envelope.ciphertext);
    const firstByte = bytes[0];
    if (firstByte === undefined) throw new Error('Brak szyfrogramu.');
    bytes[0] = firstByte ^ 1;
    await expect(decryptEnvelope(globalThis.crypto, key, {
      ...envelope,
      ciphertext: encodeBase64(bytes),
    })).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    await expect(decryptEnvelope(globalThis.crypto, key, { ...envelope, version: 0 })).rejects.toMatchObject({ code: 'AUTH_FAILED' });
  }, 20_000);

  it('odrzuca krótkie hasło, zły format i nieznaną wersję', () => {
    expect(() => validateNewPassword('krótkie')).toThrow();
    expect(() => parseEnvelope('not-json')).toThrow();
    expect(() => parseEnvelope(JSON.stringify({ version: 99 }))).toThrowError('Nieobsługiwana wersja zapisu.');
    expect(() => decodeBase64('!!!')).toThrow();
  });
});

describe('Kalibracja liczby iteracji PBKDF2', () => {
  it('skaluje liczbę iteracji do celu ~1 s i nie schodzi poniżej minimum', () => {
    expect(iterationsForMeasuredDuration(10_000, 8)).toBe(1_250_000);
    expect(iterationsForMeasuredDuration(10_000, 500)).toBe(MIN_PBKDF2_ITERATIONS);
    expect(iterationsForMeasuredDuration(10_000, 4, 500)).toBe(1_250_000);
  });

  it('ogranicza wynik do maksimum i wraca do domyślnej liczby przy błędnym pomiarze', () => {
    expect(iterationsForMeasuredDuration(10_000, 1)).toBe(MAX_PBKDF2_ITERATIONS);
    expect(iterationsForMeasuredDuration(10_000, 0)).toBe(PBKDF2_ITERATIONS);
    expect(iterationsForMeasuredDuration(10_000, Number.NaN)).toBe(PBKDF2_ITERATIONS);
    expect(iterationsForMeasuredDuration(0, 10)).toBe(PBKDF2_ITERATIONS);
    expect(iterationsForMeasuredDuration(10_000, 10, 0)).toBe(PBKDF2_ITERATIONS);
  });

  it('mierzy czas próbnego wyprowadzenia i zwraca liczbę z dozwolonego zakresu', async () => {
    await expect(calibratePbkdf2Iterations(globalThis.crypto, { measure: async () => 8 })).resolves.toBe(1_250_000);
    await expect(calibratePbkdf2Iterations(globalThis.crypto, { measure: async () => 900 })).resolves.toBe(MIN_PBKDF2_ITERATIONS);
    await expect(calibratePbkdf2Iterations(globalThis.crypto, {
      measure: async () => { throw new Error('brak pomiaru'); },
    })).resolves.toBe(PBKDF2_ITERATIONS);
    const measured = await calibratePbkdf2Iterations(globalThis.crypto);
    expect(measured).toBeGreaterThanOrEqual(MIN_PBKDF2_ITERATIONS);
    expect(measured).toBeLessThanOrEqual(MAX_PBKDF2_ITERATIONS);
  }, 20_000);

  it('zapisuje liczbę iteracji w kopercie tylko gdy różni się od domyślnej', async () => {
    const salt = randomSalt(globalThis.crypto);
    const state = createInitialState(2026);
    const key = await derivePasswordKey(globalThis.crypto, 'testowe-haslo', salt, 900_000);
    const custom = await encryptState(globalThis.crypto, key, salt, state, 900_000);
    expect(custom.iterations).toBe(900_000);
    const parsed = parseEnvelope(JSON.stringify(custom));
    expect(envelopeIterations(parsed)).toBe(900_000);
    expect(await decryptEnvelope(globalThis.crypto, key, parsed)).toEqual(state);

    const standardKey = await derivePasswordKey(globalThis.crypto, 'testowe-haslo', salt);
    await expect(decryptEnvelope(globalThis.crypto, standardKey, parsed)).rejects.toMatchObject({ code: 'AUTH_FAILED' });

    const standard = await encryptState(globalThis.crypto, standardKey, salt, state);
    expect('iterations' in standard).toBe(false);
    expect(envelopeIterations(parseEnvelope(JSON.stringify(standard)))).toBe(PBKDF2_ITERATIONS);
  }, 30_000);

  it('odrzuca liczbę iteracji spoza zakresu i złego typu', async () => {
    const salt = randomSalt(globalThis.crypto);
    const key = await derivePasswordKey(globalThis.crypto, 'testowe-haslo', salt);
    const standard = await encryptState(globalThis.crypto, key, salt, createInitialState(2026));
    for (const iterations of [MIN_PBKDF2_ITERATIONS - 1, MAX_PBKDF2_ITERATIONS + 1, 1.5, '900000']) {
      expect(() => parseEnvelope(JSON.stringify({ ...standard, iterations }))).toThrowError('Nieprawidłowy format zapisu.');
    }
    await expect(derivePasswordKey(globalThis.crypto, 'testowe-haslo', salt, MIN_PBKDF2_ITERATIONS - 1))
      .rejects.toMatchObject({ code: 'INVALID_FORMAT' });
  }, 30_000);
});
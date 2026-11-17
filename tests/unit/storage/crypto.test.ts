import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../src/state';
import {
  decodeBase64,
  decryptEnvelope,
  derivePasswordKey,
  encodeBase64,
  encryptState,
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
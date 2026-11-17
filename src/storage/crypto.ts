import { assertAppState, CURRENT_SCHEMA_VERSION } from '../state';
import type { AppState } from '../state';

export const PBKDF2_ITERATIONS = 600_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
const MAX_ENVELOPE_LENGTH = 2_000_000;

export type StorageErrorCode =
  | 'CRYPTO_UNAVAILABLE'
  | 'INVALID_FORMAT'
  | 'UNSUPPORTED_VERSION'
  | 'AUTH_FAILED'
  | 'PASSWORD_TOO_SHORT'
  | 'ALREADY_INITIALIZED'
  | 'ALREADY_UNLOCKED'
  | 'NOT_INITIALIZED'
  | 'LOCKED'
  | 'CONFIRM_REQUIRED'
  | 'CONFLICT'
  | 'OPERATION_CANCELLED'
  | 'PERSISTENCE_FAILED'
  | 'INVALID_STATE';

export class StorageError extends Error {
  constructor(
    readonly code: StorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export interface CipherEnvelope {
  readonly version: number;
  readonly salt: string;
  readonly iv: string;
  readonly ciphertext: string;
}

function cryptoAvailable(runtime: Crypto): void {
  if (!runtime || !runtime.subtle || typeof runtime.getRandomValues !== 'function') {
    throw new StorageError('CRYPTO_UNAVAILABLE', 'WebCrypto jest niedostępne.');
  }
}

function encodeUtf8(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(value));
}

export function validateNewPassword(password: string): void {
  if (typeof password !== 'string' || Array.from(password).length < 8) {
    throw new StorageError('PASSWORD_TOO_SHORT', 'Hasło musi mieć co najmniej 8 znaków.');
  }
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new StorageError('INVALID_FORMAT', 'Nieprawidłowy format zapisu.');
  }
  try {
    const binary = atob(value);
    if (btoa(binary) !== value) throw new Error('Niekanoniczny zapis.');
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    throw new StorageError('INVALID_FORMAT', 'Nieprawidłowy format zapisu.');
  }
}

export function parseEnvelope(raw: string): CipherEnvelope {
  if (typeof raw !== 'string' || raw.length > MAX_ENVELOPE_LENGTH) {
    throw new StorageError('INVALID_FORMAT', 'Nieprawidłowy format zapisu.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new StorageError('INVALID_FORMAT', 'Nieprawidłowy format zapisu.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new StorageError('INVALID_FORMAT', 'Nieprawidłowy format zapisu.');
  }
  const fields = parsed as Record<string, unknown>;
  if (typeof fields.version !== 'number' || !Number.isSafeInteger(fields.version)) {
    throw new StorageError('INVALID_FORMAT', 'Nieprawidłowa wersja zapisu.');
  }
  if (fields.version < 0 || fields.version > CURRENT_SCHEMA_VERSION) {
    throw new StorageError('UNSUPPORTED_VERSION', 'Nieobsługiwana wersja zapisu.');
  }
  if (Object.keys(fields).some((key) => !['version', 'salt', 'iv', 'ciphertext'].includes(key)) ||
    typeof fields.salt !== 'string' || typeof fields.iv !== 'string' || typeof fields.ciphertext !== 'string') {
    throw new StorageError('INVALID_FORMAT', 'Nieprawidłowy format zapisu.');
  }
  if (decodeBase64(fields.salt).length !== SALT_BYTES || decodeBase64(fields.iv).length !== IV_BYTES ||
    decodeBase64(fields.ciphertext).length < 16) {
    throw new StorageError('INVALID_FORMAT', 'Nieprawidłowy format zapisu.');
  }
  return { version: fields.version, salt: fields.salt, iv: fields.iv, ciphertext: fields.ciphertext };
}

export function randomSalt(runtime: Crypto): Uint8Array<ArrayBuffer> {
  cryptoAvailable(runtime);
  return runtime.getRandomValues(new Uint8Array(SALT_BYTES));
}

export async function derivePasswordKey(
  runtime: Crypto,
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  cryptoAvailable(runtime);
  if (typeof password !== 'string' || salt.length !== SALT_BYTES) {
    throw new StorageError('INVALID_FORMAT', 'Nieprawidłowe dane szyfrowania.');
  }
  try {
    const material = await runtime.subtle.importKey(
      'raw', encodeUtf8(password), 'PBKDF2', false, ['deriveKey'],
    );
    return await runtime.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } catch {
    throw new StorageError('CRYPTO_UNAVAILABLE', 'Nie można wyprowadzić klucza szyfrowania.');
  }
}

function additionalData(version: number): Uint8Array<ArrayBuffer> {
  return encodeUtf8(`zwierzeta-losuja:${version}`);
}

export async function encryptState(
  runtime: Crypto,
  key: CryptoKey,
  salt: Uint8Array<ArrayBuffer>,
  state: AppState,
): Promise<CipherEnvelope> {
  cryptoAvailable(runtime);
  assertAppState(state);
  if (salt.length !== SALT_BYTES) throw new StorageError('INVALID_FORMAT', 'Nieprawidłowa sól.');
  const iv = runtime.getRandomValues(new Uint8Array(IV_BYTES));
  try {
    const ciphertext = await runtime.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: additionalData(state.schemaVersion), tagLength: 128 },
      key,
      encodeUtf8(JSON.stringify(state)),
    );
    return {
      version: state.schemaVersion,
      salt: encodeBase64(salt),
      iv: encodeBase64(iv),
      ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    };
  } catch {
    throw new StorageError('CRYPTO_UNAVAILABLE', 'Nie można zaszyfrować stanu.');
  }
}

export async function decryptEnvelope(runtime: Crypto, key: CryptoKey, envelope: CipherEnvelope): Promise<unknown> {
  cryptoAvailable(runtime);
  const iv = decodeBase64(envelope.iv);
  const ciphertext = decodeBase64(envelope.ciphertext);
  try {
    const plaintext = await runtime.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: additionalData(envelope.version), tagLength: 128 },
      key,
      ciphertext,
    );
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)) as unknown;
  } catch {
    throw new StorageError('AUTH_FAILED', 'Nieprawidłowe hasło lub uszkodzone dane.');
  }
}
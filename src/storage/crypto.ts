import { assertAppState, CURRENT_SCHEMA_VERSION } from '../state';
import type { AppState } from '../state';

export const PBKDF2_ITERATIONS = 600_000;
export const MIN_PBKDF2_ITERATIONS = PBKDF2_ITERATIONS;
export const MAX_PBKDF2_ITERATIONS = 5_000_000;
export const KEY_DERIVATION_TARGET_MS = 1_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
const MAX_ENVELOPE_LENGTH = 2_000_000;
const PROBE_PBKDF2_ITERATIONS = 10_000;
const CALIBRATION_PASSWORD = 'pomiar-czasu-wyprowadzania-klucza';

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
  // Absent in saves created before calibration existed; PBKDF2_ITERATIONS then applies.
  readonly iterations?: number;
}

export function envelopeIterations(envelope: CipherEnvelope): number {
  return envelope.iterations ?? PBKDF2_ITERATIONS;
}

function validIterations(iterations: number): boolean {
  return Number.isSafeInteger(iterations) &&
    iterations >= MIN_PBKDF2_ITERATIONS && iterations <= MAX_PBKDF2_ITERATIONS;
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
  if (Object.keys(fields).some((key) => !['version', 'salt', 'iv', 'ciphertext', 'iterations'].includes(key)) ||
    typeof fields.salt !== 'string' || typeof fields.iv !== 'string' || typeof fields.ciphertext !== 'string') {
    throw new StorageError('INVALID_FORMAT', 'Nieprawidłowy format zapisu.');
  }
  if (fields.iterations !== undefined &&
    (typeof fields.iterations !== 'number' || !validIterations(fields.iterations))) {
    throw new StorageError('INVALID_FORMAT', 'Nieprawidłowy format zapisu.');
  }
  if (decodeBase64(fields.salt).length !== SALT_BYTES || decodeBase64(fields.iv).length !== IV_BYTES ||
    decodeBase64(fields.ciphertext).length < 16) {
    throw new StorageError('INVALID_FORMAT', 'Nieprawidłowy format zapisu.');
  }
  const envelope: CipherEnvelope = { version: fields.version, salt: fields.salt, iv: fields.iv, ciphertext: fields.ciphertext };
  return fields.iterations === undefined ? envelope : { ...envelope, iterations: fields.iterations };
}

export function randomSalt(runtime: Crypto): Uint8Array<ArrayBuffer> {
  cryptoAvailable(runtime);
  return runtime.getRandomValues(new Uint8Array(SALT_BYTES));
}

async function deriveKeyWithIterations(
  runtime: Crypto,
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await runtime.subtle.importKey(
    'raw', encodeUtf8(password), 'PBKDF2', false, ['deriveKey'],
  );
  return runtime.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function derivePasswordKey(
  runtime: Crypto,
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  cryptoAvailable(runtime);
  if (typeof password !== 'string' || salt.length !== SALT_BYTES || !validIterations(iterations)) {
    throw new StorageError('INVALID_FORMAT', 'Nieprawidłowe dane szyfrowania.');
  }
  try {
    return await deriveKeyWithIterations(runtime, password, salt, iterations);
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
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CipherEnvelope> {
  cryptoAvailable(runtime);
  assertAppState(state);
  if (salt.length !== SALT_BYTES || !validIterations(iterations)) {
    throw new StorageError('INVALID_FORMAT', 'Nieprawidłowa sól.');
  }
  const iv = runtime.getRandomValues(new Uint8Array(IV_BYTES));
  try {
    const ciphertext = await runtime.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: additionalData(state.schemaVersion), tagLength: 128 },
      key,
      encodeUtf8(JSON.stringify(state)),
    );
    const envelope: CipherEnvelope = {
      version: state.schemaVersion,
      salt: encodeBase64(salt),
      iv: encodeBase64(iv),
      ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    };
    // The default count stays implicit so older saves and readers keep the same format.
    return iterations === PBKDF2_ITERATIONS ? envelope : { ...envelope, iterations };
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

export interface KeyDerivationCalibrationOptions {
  // Derivation time to aim for; defaults to KEY_DERIVATION_TARGET_MS (~1 s).
  readonly targetMs?: number;
  readonly probeIterations?: number;
  // Injectable probe (elapsed ms for the given iteration count) for tests and diagnostics.
  readonly measure?: (iterations: number) => Promise<number>;
  readonly now?: () => number;
}

export function iterationsForMeasuredDuration(
  probeIterations: number,
  elapsedMs: number,
  targetMs: number = KEY_DERIVATION_TARGET_MS,
): number {
  if (!Number.isSafeInteger(probeIterations) || probeIterations <= 0 ||
    !Number.isFinite(elapsedMs) || elapsedMs <= 0 ||
    !Number.isFinite(targetMs) || targetMs <= 0) {
    return PBKDF2_ITERATIONS;
  }
  const scaled = Math.round((probeIterations * targetMs) / elapsedMs / 1_000) * 1_000;
  return Math.min(MAX_PBKDF2_ITERATIONS, Math.max(MIN_PBKDF2_ITERATIONS, scaled));
}

// Measures one short probe derivation on this device and scales the iteration count so that
// unlocking takes up to ~1 s, never dropping below the 600 000 minimum from SECURITY-SPEC.
// The result is meant to be stored in the save envelope at password setup time (store.initialize).
export async function calibratePbkdf2Iterations(
  runtime: Crypto,
  options: KeyDerivationCalibrationOptions = {},
): Promise<number> {
  cryptoAvailable(runtime);
  const targetMs = options.targetMs !== undefined && Number.isFinite(options.targetMs) && options.targetMs > 0
    ? options.targetMs
    : KEY_DERIVATION_TARGET_MS;
  const probeIterations = options.probeIterations !== undefined &&
    Number.isSafeInteger(options.probeIterations) && options.probeIterations > 0
    ? options.probeIterations
    : PROBE_PBKDF2_ITERATIONS;
  const now = options.now ?? (() => globalThis.performance.now());
  const measure = options.measure ?? (async (iterations: number) => {
    const started = now();
    await deriveKeyWithIterations(runtime, CALIBRATION_PASSWORD, randomSalt(runtime), iterations);
    return now() - started;
  });
  try {
    return iterationsForMeasuredDuration(probeIterations, await measure(probeIterations), targetMs);
  } catch {
    return PBKDF2_ITERATIONS;
  }
}
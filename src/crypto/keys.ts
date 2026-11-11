import { randomToken } from "./webcrypto";

/** Klucze prywatne i sekret admina pozostają wyłącznie w localStorage przeglądarki. */

const KEY_PREFIX = "secret-santa:v1";

export function getBrowserUid(): string {
  const key = `${KEY_PREFIX}:uid`;
  let uid = localStorage.getItem(key);
  if (!uid) {
    uid = randomToken(16);
    localStorage.setItem(key, uid);
  }
  return uid;
}

export function readPrivateKey(drawId: string, token: string): JsonWebKey | null {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}:key:${drawId}:${token}`);
    return raw ? (JSON.parse(raw) as JsonWebKey) : null;
  } catch {
    return null;
  }
}

export function savePrivateKey(
  drawId: string,
  token: string,
  key: JsonWebKey,
): void {
  localStorage.setItem(
    `${KEY_PREFIX}:key:${drawId}:${token}`,
    JSON.stringify(key),
  );
}

export type AdminSecret = { adminToken: string; privateKey: JsonWebKey | null };

export function readAdminSecret(drawId: string): AdminSecret | null {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}:admin:${drawId}`);
    return raw ? (JSON.parse(raw) as AdminSecret) : null;
  } catch {
    return null;
  }
}

export function saveAdminSecret(drawId: string, secret: AdminSecret): void {
  localStorage.setItem(
    `${KEY_PREFIX}:admin:${drawId}`,
    JSON.stringify(secret),
  );
}

export type StoredLink = { id: string; name: string; token: string };

export function readAdminLinks(drawId: string): StoredLink[] {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}:links:${drawId}`);
    return raw ? (JSON.parse(raw) as StoredLink[]) : [];
  } catch {
    return [];
  }
}

export function saveAdminLinks(drawId: string, links: StoredLink[]): void {
  localStorage.setItem(
    `${KEY_PREFIX}:links:${drawId}`,
    JSON.stringify(links),
  );
}

/** WebCrypto: RSA-OAEP 2048. Wyniki w bazie istnieją wyłącznie jako szyfrogramy. */

const ALGORITHM: RsaHashedKeyGenParams = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

export type KeyPairJwk = { publicKey: JsonWebKey; privateKey: JsonWebKey };

export async function generateKeyPair(): Promise<KeyPairJwk> {
  const pair = await crypto.subtle.generateKey(ALGORITHM, true, [
    "encrypt",
    "decrypt",
  ]);
  return {
    publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey),
    privateKey: await crypto.subtle.exportKey("jwk", pair.privateKey),
  };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** Z klucza prywatnego (link ratunkowy) odtwarzamy pasujący klucz publiczny. */
export function publicFromPrivate(privateJwk: JsonWebKey): JsonWebKey {
  return {
    kty: "RSA",
    n: privateJwk.n,
    e: privateJwk.e,
    ext: true,
  };
}

export async function encryptFor(
  publicJwk: JsonWebKey,
  plaintext: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const data = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, data);
  return toBase64(new Uint8Array(cipher));
}

export async function decryptWith(
  privateJwk: JsonWebKey,
  ciphertext: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    key,
    fromBase64(ciphertext),
  );
  return new TextDecoder().decode(plain);
}

/** 128 bitów losowości, bezpieczne w URL (capability token). */
export function randomToken(bytes = 16): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return toBase64(raw)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/** Link ratunkowy: klucz prywatny zakodowany w hashu URL. */
export function encodeKeyForUrl(key: JsonWebKey): string {
  const json = JSON.stringify(key);
  const bytes = new TextEncoder().encode(json);
  return toBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodeKeyFromUrl(value: string): JsonWebKey | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = fromBase64(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (
      parsed &&
      typeof parsed === "object" &&
      "d" in parsed &&
      "n" in parsed
    ) {
      return parsed as JsonWebKey;
    }
    return null;
  } catch {
    return null;
  }
}

import { describe, expect, it } from "vitest";
import {
  decodeKeyFromUrl,
  decryptWith,
  encodeKeyForUrl,
  encryptFor,
  generateKeyPair,
  publicFromPrivate,
  randomToken,
} from "../src/crypto/webcrypto";

describe("WebCrypto: wyniki wyłącznie jako szyfrogramy", () => {
  it("odszyfrowuje wynik wyłącznie właściwym kluczem", async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const payload = JSON.stringify({ receiver: "Celina", receiverId: "p3" });

    const cipher = await encryptFor(alice.publicKey, payload);
    expect(cipher).not.toContain("Celina");
    expect(await decryptWith(alice.privateKey, cipher)).toBe(payload);
    await expect(decryptWith(bob.privateKey, cipher)).rejects.toThrow();
  });

  it("link ratunkowy odtwarza klucz prywatny i pasujący klucz publiczny", async () => {
    const pair = await generateKeyPair();
    const encoded = encodeKeyForUrl(pair.privateKey);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const restored = decodeKeyFromUrl(encoded);
    expect(restored).not.toBeNull();

    const cipher = await encryptFor(publicFromPrivate(pair.privateKey), "Ania");
    expect(await decryptWith(restored!, cipher)).toBe("Ania");
    expect(decodeKeyFromUrl("niepoprawny-klucz")).toBeNull();
  });

  it("token ma co najmniej 128 bitów losowości i jest bezpieczny w URL", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
});

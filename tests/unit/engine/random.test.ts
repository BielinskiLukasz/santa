import { describe, expect, it } from 'vitest';
import { createCryptoRandom, createSeededRandom } from '../../../src/engine';
import type { RandomValuesProvider } from '../../../src/engine';

describe('Źródła losowości', () => {
  it('odrzuca niepełny zakres przed operacją modulo', () => {
    const samples = [0xffffffff, 14];
    let calls = 0;
    const source: RandomValuesProvider = {
      getRandomValues(values) {
        calls++;
        const value = samples.shift();
        if (value === undefined) throw new Error('Brak próbki testowej.');
        values[0] = value;
        return values;
      },
    };
    expect(createCryptoRandom(source)(10)).toBe(4);
    expect(calls).toBe(2);
  });

  it('obsługuje pełny zakres uint32', () => {
    const source: RandomValuesProvider = {
      getRandomValues(values) {
        values[0] = 0xffffffff;
        return values;
      },
    };
    expect(createCryptoRandom(source)(2 ** 32)).toBe(0xffffffff);
  });

  it('współpracuje z systemowym Web Crypto', () => {
    const value = createCryptoRandom(globalThis.crypto)(7);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(7);
  });

  it('daje powtarzalną sekwencję dla tego samego ziarna', () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);
    const third = createSeededRandom(43);
    const sequence = Array.from({ length: 100 }, () => first(7));
    expect(Array.from({ length: 100 }, () => second(7))).toEqual(sequence);
    expect(Array.from({ length: 100 }, () => third(7))).not.toEqual(sequence);
    expect(sequence.every((value) => value >= 0 && value < 7)).toBe(true);
  });

  it('odrzuca niepoprawne zakresy i ziarna', () => {
    expect(() => createCryptoRandom({} as RandomValuesProvider)).toThrow(TypeError);
    const random = createSeededRandom(0);
    for (const bound of [0, -1, 1.5, NaN, Infinity, 2 ** 32 + 1]) {
      expect(() => random(bound)).toThrow(RangeError);
    }
    for (const seed of [-1, 1.5, NaN, 2 ** 32]) {
      expect(() => createSeededRandom(seed)).toThrow(RangeError);
    }
  });
});
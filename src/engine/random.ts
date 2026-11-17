import type { Random, RandomValuesProvider } from './types';

const UINT32_RANGE = 2 ** 32;

function boundedRandom(exclusiveUpperBound: number, nextUint32: () => number): number {
  if (!Number.isInteger(exclusiveUpperBound) || exclusiveUpperBound < 1 || exclusiveUpperBound > UINT32_RANGE) {
    throw new RangeError('Zakres losowania musi być liczbą całkowitą od 1 do 2^32.');
  }
  const limit = UINT32_RANGE - (UINT32_RANGE % exclusiveUpperBound);
  let value: number;
  do {
    value = nextUint32();
  } while (value >= limit);
  return value % exclusiveUpperBound;
}

export function createCryptoRandom(source: RandomValuesProvider): Random {
  if (!source || typeof source.getRandomValues !== 'function') {
    throw new TypeError('Wymagane jest źródło crypto.getRandomValues.');
  }
  const values = new Uint32Array(1);
  return (exclusiveUpperBound) => boundedRandom(exclusiveUpperBound, () => {
    const result = source.getRandomValues(values);
    const value = result[0];
    if (value === undefined) throw new Error('Źródło losowe nie zwróciło wartości.');
    return value;
  });
}

// Deterministic generator for tests only; production must use createCryptoRandom.
export function createSeededRandom(seed: number): Random {
  if (!Number.isInteger(seed) || seed < 0 || seed >= UINT32_RANGE) {
    throw new RangeError('Ziarno musi być liczbą całkowitą z zakresu uint32.');
  }
  let state = seed >>> 0;
  return (exclusiveUpperBound) => boundedRandom(exclusiveUpperBound, () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  });
}
/** Deterministyczny PRNG: FNV-1a + mulberry32. Ten sam seed => ten sam przebieg. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Osobny, powtarzalny strumień losowości dla każdej osoby i kroku. */
export function rngFor(seed: string, ...parts: (string | number)[]): () => number {
  return mulberry32(hashString([seed, ...parts].join("|")));
}

/** Etykieta seeda dla animacji – nie zdradza wyniku, pozwala odtworzyć przebieg. */
export function animationSeed(seed: string, giver: string, index: number): number {
  return hashString(`${seed}|anim|${giver}|${index}`);
}

export function popCount(mask: number): number {
  let c = 0;
  let m = mask;
  while (m) {
    m &= m - 1;
    c += 1;
  }
  return c;
}

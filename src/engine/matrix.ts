import type { Constraint, Participant } from "./types";
import { popCount } from "./prng";

/** Macierz allowed[i][j]: false dla i→i oraz dla skierowanych zakazów. */
export function buildAllowedMatrix(
  participants: Participant[],
  constraints: Constraint[],
): boolean[][] {
  const n = participants.length;
  const index = new Map(participants.map((p, i) => [p.id, i]));
  const matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => i !== j),
  );
  for (const [from, to] of constraints) {
    const i = index.get(from);
    const j = index.get(to);
    if (i !== undefined && j !== undefined) matrix[i][j] = false;
  }
  return matrix;
}

/**
 * Liczba perfekcyjnych skojarzeń (permanent macierzy 0/1) dla pozostałych osób.
 * DP po maskach bitowych: stan = maska zajętych odbiorców; pozycja wynika z liczby
 * bitów w masce. Złożoność O(2^n · n), dla n ≤ 10 to ~10 tys. operacji.
 * `takenMask` opisuje odbiorców niedostępnych, `givers` to indeksy oczekujących.
 */
export function countCompletions(
  allowed: boolean[][],
  givers: number[],
  takenMask: number,
): number {
  const n = allowed.length;
  const memo = new Map<number, number>();

  const dfs = (mask: number): number => {
    const pos = givers.length - (n - popCount(mask));
    if (pos >= givers.length) return 1;
    const cached = memo.get(mask);
    if (cached !== undefined) return cached;
    const i = givers[pos];
    let total = 0;
    for (let j = 0; j < n; j += 1) {
      if (mask & (1 << j)) continue;
      if (!allowed[i][j]) continue;
      total += dfs(mask | (1 << j));
    }
    memo.set(mask, total);
    return total;
  };

  return dfs(takenMask);
}

export function indexMaps(participants: Participant[]) {
  return {
    byId: new Map(participants.map((p, i) => [p.id, i])),
    byIndex: participants.map((p) => p.id),
  };
}

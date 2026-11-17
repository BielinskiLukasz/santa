import { describe, expect, it } from 'vitest';
import { buildGraph, createSeededRandom, drawFor, hasPerfectMatching, validCandidates } from '../../../src/engine';
import type { Rule } from '../../../src/engine';
import { makeParticipants, makeState } from './fixtures';

function edgeKey(giverId: string, receiverId: string): string {
  return JSON.stringify([giverId, receiverId]);
}

function bruteMatching(
  givers: readonly string[],
  receivers: readonly string[],
  blocked: ReadonlySet<string>,
): { giverId: string; receiverId: string }[] | null {
  if (givers.length !== receivers.length) return null;
  const [giverId, ...remainingGivers] = givers;
  if (giverId === undefined) return [];
  for (const [index, receiverId] of receivers.entries()) {
    if (giverId === receiverId || blocked.has(edgeKey(giverId, receiverId))) continue;
    const remainingReceivers = [...receivers.slice(0, index), ...receivers.slice(index + 1)];
    const rest = bruteMatching(remainingGivers, remainingReceivers, blocked);
    if (rest !== null) return [{ giverId, receiverId }, ...rest];
  }
  return null;
}

describe('Skojarzenie doskonałe', () => {
  it('obsługuje pusty graf i odrzuca niepoprawne zbiory wierzchołków', () => {
    const graph = buildGraph(makeParticipants(3), []);
    expect(hasPerfectMatching(graph, [], [])).toBe(true);
    expect(hasPerfectMatching(graph, ['p0'], ['p1', 'p2'])).toBe(false);
    expect(hasPerfectMatching(graph, ['p0', 'p0'], ['p1', 'p2'])).toBe(false);
    expect(hasPerfectMatching(graph, ['p0', 'p1'], ['p2', 'p2'])).toBe(false);
    expect(hasPerfectMatching(graph, ['unknown'], ['p0'])).toBe(false);
  });

  it('zgadza się z przeszukiwaniem siłowym dla grafów od 2 do 7 osób', () => {
    const random = createSeededRandom(0x12345678);
    for (let count = 2; count <= 7; count++) {
      const people = makeParticipants(count);
      const ids = people.map((person) => person.id);
      for (let sample = 0; sample < 80; sample++) {
        const rules: Rule[] = [];
        const blocked = new Set<string>();
        for (const giverId of ids) {
          for (const receiverId of ids) {
            if (giverId !== receiverId && random(100) < 38) {
              rules.push({ giverId, receiverId, reason: 'MANUAL' });
              blocked.add(edgeKey(giverId, receiverId));
            }
          }
        }
        const graph = buildGraph(people, rules);
        const solution = bruteMatching(ids, ids, blocked);
        expect(hasPerfectMatching(graph, ids, ids)).toBe(solution !== null);

        const state = makeState(count, rules);
        for (const giverId of ids) {
          const expected = ids.filter((receiverId) =>
            giverId !== receiverId &&
            !blocked.has(edgeKey(giverId, receiverId)) &&
            bruteMatching(ids.filter((id) => id !== giverId), ids.filter((id) => id !== receiverId), blocked) !== null,
          );
          expect(validCandidates(state, giverId)).toEqual(expected);
        }

        if (solution !== null) {
          const draws = solution.slice(0, random(count)).map((draw) => ({ ...draw, revealCompleted: true }));
          const usedGivers = new Set(draws.map((draw) => draw.giverId));
          const usedReceivers = new Set(draws.map((draw) => draw.receiverId));
          const freeGivers = ids.filter((id) => !usedGivers.has(id));
          const freeReceivers = ids.filter((id) => !usedReceivers.has(id));
          const giverId = freeGivers[0];
          if (giverId === undefined) throw new Error('Brak uczestnika do porównania.');
          const expected = freeReceivers.filter((receiverId) =>
            giverId !== receiverId &&
            !blocked.has(edgeKey(giverId, receiverId)) &&
            bruteMatching(freeGivers.slice(1), freeReceivers.filter((id) => id !== receiverId), blocked) !== null,
          );
          expect(validCandidates(makeState(count, rules, draws), giverId)).toEqual(expected);
        }
      }
    }
  }, 30_000);

  it('wybiera w przybliżeniu równomiernie spośród poprawnych kandydatów', () => {
    const state = makeState(7);
    const random = createSeededRandom(987654321);
    const counts = new Map<string, number>();
    const trials = 12_000;
    for (let index = 0; index < trials; index++) {
      const receiver = drawFor(state, 'p0', random).draw.receiverId;
      counts.set(receiver, (counts.get(receiver) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    const expected = trials / 6;
    const chiSquared = [...counts.values()].reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);
    expect(chiSquared).toBeLessThan(30);
  }, 30_000);
});
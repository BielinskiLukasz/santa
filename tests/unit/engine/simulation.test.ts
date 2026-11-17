import { describe, expect, it } from 'vitest';
import { createSeededRandom, drawFor, undoLastDraw, validateSetup } from '../../../src/engine';
import type { Rule } from '../../../src/engine';
import { makeParticipants, makeState } from './fixtures';

describe('Symulacje pełnego wydarzenia', () => {
  it('kończy 2000 rozwiązywalnych losowań bez łamania reguł', () => {
    const runs = 2_000;
    let completed = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const count = 7 + (seed % 6);
      const random = createSeededRandom(seed);
      const people = makeParticipants(count);
      const shift = random(count - 1) + 1;
      const rules: Rule[] = [];

      // Keep one known derangement legal while randomly excluding other edges.
      for (let giver = 0; giver < count; giver++) {
        for (let receiver = 0; receiver < count; receiver++) {
          if (giver === receiver || receiver === (giver + shift) % count || random(100) >= 45) continue;
          rules.push({ giverId: `p${giver}`, receiverId: `p${receiver}`, reason: 'MANUAL' });
        }
      }
      const setup = validateSetup(people, rules);
      if (!setup.ok) throw new Error(`Rozwiązywalna konfiguracja została odrzucona: ${seed}`);

      let state = makeState(count, rules);
      const order = [...people];
      let step = 0;
      while (order.length > 0) {
        const person = order.splice(random(order.length), 1)[0];
        if (!person) throw new Error(`Brak uczestnika: ${seed}`);
        state = drawFor(state, person.id, random).state;
        if (seed % 17 === 0 && step === 0) {
          const undone = undoLastDraw(state);
          if (undone.undoneGiverId !== person.id) throw new Error(`Błąd cofnięcia: ${seed}`);
          state = drawFor(undone.state, person.id, random).state;
        }
        step++;
      }

      const givers = new Set(state.draws.map((draw) => draw.giverId));
      const receivers = new Set(state.draws.map((draw) => draw.receiverId));
      if (state.draws.length !== count || givers.size !== count || receivers.size !== count) {
        throw new Error(`Niepełny lub powtórzony przydział: ${seed}`);
      }
      for (const draw of state.draws) {
        if (draw.giverId === draw.receiverId || rules.some((rule) =>
          rule.giverId === draw.giverId && rule.receiverId === draw.receiverId,
        )) {
          throw new Error(`Złamana reguła: ${seed}`);
        }
      }
      completed++;
    }
    expect(completed).toBe(runs);
  }, 90_000);
});
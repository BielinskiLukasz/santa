import type { Draw, EventState, Participant, Rule } from '../../../src/engine';

export function makeParticipants(count: number): Participant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    name: `Osoba ${index}`,
    animal: `animal-${index}`,
  }));
}

export function makeState(
  count: number,
  rules: readonly Rule[] = [],
  draws: readonly Draw[] = [],
): EventState {
  return {
    event: { year: 2026, currency: 'PLN', phase: 'DRAWING', budget: 100 },
    participants: makeParticipants(count),
    rules,
    draws,
  };
}
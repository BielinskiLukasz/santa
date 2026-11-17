import { describe, expect, it } from 'vitest';
import { createSeededRandom, drawFor, validCandidates } from '../../../src/engine';
import {
  assertAppState,
  completeInterruptedReveals,
  createInitialState,
  migrateState,
  reduceAppState,
  StateError,
} from '../../../src/state';
import { configuration, drawingState } from './fixtures';

describe('Maszyna stanów wydarzenia', () => {
  it('zaczyna od konfiguracji po utworzeniu lub odblokowaniu sesji', () => {
    const state = createInitialState(2026);
    expect(state.schemaVersion).toBe(1);
    expect(state.event).toEqual({ year: 2026, currency: 'PLN', phase: 'SETUP', budget: null });
    expect(state.draws).toEqual([]);
    expect(() => createInitialState(0)).toThrow(StateError);
  });

  it('zachowuje szkic, ale nie rozpoczyna wydarzenia dla mniej niż 7 osób', () => {
    const draft = configuration(6);
    const state = reduceAppState(createInitialState(2026), { type: 'CONFIGURE', configuration: draft });
    expect(state.participants).toHaveLength(6);
    expect(() => reduceAppState(state, { type: 'START_BUDGET' })).toThrow(StateError);
    expect(state.event.phase).toBe('SETUP');
  });

  it('tworzy reguły par, poprzedniego roku i zakazów ręcznych', () => {
    const initial = createInitialState(2026);
    const state = reduceAppState(initial, { type: 'CONFIGURE', configuration: configuration() });
    expect(initial.participants).toHaveLength(0);
    expect(state.rules).toEqual(expect.arrayContaining([
      { giverId: 'p0', receiverId: 'p1', reason: 'COUPLE' },
      { giverId: 'p1', receiverId: 'p0', reason: 'COUPLE' },
      { giverId: 'p2', receiverId: 'p3', reason: 'LAST_YEAR' },
      { giverId: 'p4', receiverId: 'p5', reason: 'MANUAL' },
    ]));
  });

  it('nie stosuje zeszłorocznej reguły wobec osoby spoza obecnego wydarzenia', () => {
    const setup = { ...configuration(), previousDraws: [{ giverId: 'p2', receiverId: 'former' }] };
    const state = reduceAppState(createInitialState(2026), { type: 'CONFIGURE', configuration: setup });
    expect(state.previousDraws).toEqual(setup.previousDraws);
    expect(state.rules.some((rule) => rule.reason === 'LAST_YEAR')).toBe(false);
    expect(reduceAppState(state, { type: 'START_BUDGET' }).event.phase).toBe('BUDGET');
  });

  it('odrzuca złe przejścia i niepoprawny budżet', () => {
    const initial = createInitialState(2026);
    expect(() => reduceAppState(initial, { type: 'START_DRAWING' })).toThrow(StateError);
    let state = reduceAppState(initial, { type: 'CONFIGURE', configuration: configuration() });
    state = reduceAppState(state, { type: 'START_BUDGET' });
    expect(() => reduceAppState(state, { type: 'START_DRAWING' })).toThrow(StateError);
    expect(() => reduceAppState(state, { type: 'SET_BUDGET', amount: 9 })).toThrow(StateError);
    state = reduceAppState(state, { type: 'SET_BUDGET', amount: 101 });
    expect(reduceAppState(state, { type: 'START_DRAWING' }).event.budget).toBe(101);
  });

  it('jest idempotentna i blokuje kolejne losowanie do zakończenia ujawnienia', () => {
    const initial = drawingState();
    const receiverId = validCandidates(initial, 'p0')[0];
    if (!receiverId) throw new Error('Brak kandydata testowego.');
    const action = { type: 'DRAW', giverId: 'p0', receiverId } as const;
    const drawn = reduceAppState(initial, action);
    expect(initial.draws).toHaveLength(0);
    expect(drawn.draws[0]?.revealCompleted).toBe(false);
    expect(reduceAppState(drawn, action)).toBe(drawn);
    expect(() => reduceAppState(drawn, { type: 'DRAW', giverId: 'p1', receiverId: 'p2' })).toThrow(StateError);

    const completed = reduceAppState(drawn, { type: 'COMPLETE_REVEAL', giverId: 'p0' });
    expect(completed.draws[0]?.revealCompleted).toBe(true);
    expect(reduceAppState(completed, action)).toBe(completed);
    expect(reduceAppState(completed, { type: 'COMPLETE_REVEAL', giverId: 'p0' })).toBe(completed);
  });

  it('nie przyjmuje niedozwolonego przydziału', () => {
    const state = drawingState();
    expect(() => reduceAppState(state, { type: 'DRAW', giverId: 'p0', receiverId: 'p0' })).toThrow(StateError);
    expect(() => reduceAppState(state, { type: 'DRAW', giverId: 'p0', receiverId: 'p1' })).toThrow(StateError);
    expect(state.draws).toHaveLength(0);
  });

  it('zamyka wydarzenie po ujawnieniu ostatniego wyniku, a cofnięcie przywraca losowanie', () => {
    let state = drawingState();
    const random = createSeededRandom(17);
    for (const person of state.participants) {
      const selected = drawFor(state, person.id, random).draw;
      state = reduceAppState(state, { type: 'DRAW', giverId: person.id, receiverId: selected.receiverId });
      state = reduceAppState(state, { type: 'COMPLETE_REVEAL', giverId: person.id });
    }
    expect(state.event.phase).toBe('DONE');
    const last = state.draws.at(-1);
    if (!last) throw new Error('Brak ostatniego przydziału.');
    expect(reduceAppState(state, { type: 'DRAW', giverId: last.giverId, receiverId: last.receiverId })).toBe(state);
    const undone = reduceAppState(state, { type: 'UNDO_LAST_DRAW' });
    expect(undone.event.phase).toBe('DRAWING');
    expect(undone.event.budget).toBe(101);
    expect(undone.draws).toHaveLength(6);
    expect(validCandidates(undone, last.giverId)).toContain(last.receiverId);
  });

  it('po przerwaniu kończy sesję ujawnienia i zachowuje postęp', () => {
    const initial = drawingState();
    const receiverId = validCandidates(initial, 'p0')[0];
    if (!receiverId) throw new Error('Brak kandydata testowego.');
    const pending = reduceAppState(initial, { type: 'DRAW', giverId: 'p0', receiverId });
    const recovered = completeInterruptedReveals(pending);
    expect(recovered.draws[0]?.revealCompleted).toBe(true);
    expect(recovered.event.phase).toBe('DRAWING');
    expect(completeInterruptedReveals(recovered)).toBe(recovered);
    expect(() => reduceAppState(pending, { type: 'UNDO_LAST_DRAW' })).toThrow(StateError);
  });

  it('po przerwaniu ostatniego ujawnienia przechodzi do podsumowania', () => {
    let state = drawingState();
    const random = createSeededRandom(23);
    for (const [index, person] of state.participants.entries()) {
      const selected = drawFor(state, person.id, random).draw;
      state = reduceAppState(state, { type: 'DRAW', giverId: person.id, receiverId: selected.receiverId });
      if (index < state.participants.length - 1) {
        state = reduceAppState(state, { type: 'COMPLETE_REVEAL', giverId: person.id });
      }
    }
    expect(state.event.phase).toBe('DRAWING');
    const restored = completeInterruptedReveals(state);
    expect(restored.event.phase).toBe('DONE');
    expect(restored.draws.every((entry) => entry.revealCompleted)).toBe(true);
  });

  it('resetuje przydziały, zachowując konfigurację i budżet', () => {
    const initial = drawingState();
    const receiverId = validCandidates(initial, 'p0')[0];
    if (!receiverId) throw new Error('Brak kandydata testowego.');
    const pending = reduceAppState(initial, { type: 'DRAW', giverId: 'p0', receiverId });
    const reset = reduceAppState(pending, { type: 'RESET_DRAWING' });
    expect(reset.draws).toEqual([]);
    expect(reset.event.phase).toBe('BUDGET');
    expect(reset.event.budget).toBe(101);
    expect(reset.participants).toEqual(initial.participants);
    expect(reset.rules).toEqual(initial.rules);
  });
});

describe('Wersjonowanie i walidacja stanu', () => {
  it('przyjmuje bieżący schemat i odrzuca nieznany', () => {
    const initial = createInitialState(2026);
    expect(migrateState(initial)).toBe(initial);
    expect(() => migrateState({ ...initial, schemaVersion: 2 })).toThrow(StateError);
    expect(() => migrateState({ schemaVersion: 0 })).toThrow(StateError);
  });

  it('uruchamia jawną migrację do kolejnej wersji', () => {
    const initial = createInitialState(2026);
    const migrated = migrateState({ schemaVersion: 0 }, { 0: () => initial });
    expect(migrated).toEqual(initial);
    expect(() => migrateState({ schemaVersion: 0 }, { 0: () => ({ schemaVersion: 0 }) })).toThrow(StateError);
  });

  it('odrzuca niespójne reguły i zapisy nieprawidłowych przydziałów', () => {
    const ready = drawingState();
    expect(() => assertAppState({ ...ready, rules: [] })).toThrow(StateError);
    expect(() => assertAppState({
      ...ready,
      draws: [{ giverId: 'p0', receiverId: 'p0', revealCompleted: false }],
    })).toThrow(StateError);
    expect(() => assertAppState({ ...ready, event: { ...ready.event, phase: 'LOCKED' } })).toThrow(StateError);
  });
});
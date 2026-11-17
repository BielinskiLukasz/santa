import { describe, expect, it, vi } from 'vitest';
import { drawFor, EngineError, undoLastDraw, validCandidates } from '../../../src/engine';
import type { Draw, Rule } from '../../../src/engine';
import { makeState } from './fixtures';

describe('Losowanie i cofanie', () => {
  it('odrzuca kandydatów prowadzących do ślepej uliczki', () => {
    const rules: Rule[] = [{ giverId: 'p1', receiverId: 'p0', reason: 'MANUAL' }];
    const state = makeState(3, rules);
    expect(validCandidates(state, 'p0')).toEqual(['p1']);

    const result = drawFor(state, 'p0', () => 0);
    expect(result.draw).toEqual({ giverId: 'p0', receiverId: 'p1', revealCompleted: false });
    expect(state.draws).toEqual([]);
    expect(result.state.event).toBe(state.event);
    expect(Object.keys(result.draw).sort()).toEqual(['giverId', 'receiverId', 'revealCompleted']);
  });

  it('zwraca ten sam wynik bez kolejnego użycia RNG', () => {
    const random = vi.fn(() => 0);
    const first = drawFor(makeState(3), 'p0', random);
    const again = drawFor(first.state, 'p0', random);
    expect(again.state).toBe(first.state);
    expect(again.draw).toBe(first.draw);
    expect(random).toHaveBeenCalledTimes(1);
    expect(validCandidates(first.state, 'p0')).toEqual([]);
  });

  it('zachowuje flagę już ujawnionego wyniku przy ponownym wywołaniu', () => {
    const existing: Draw = { giverId: 'p0', receiverId: 'p1', revealCompleted: true };
    const state = makeState(3, [], [existing]);
    const result = drawFor(state, 'p0', () => { throw new Error('RNG nie powinno być wywołane'); });
    expect(result.draw).toBe(existing);
    expect(result.draw.revealCompleted).toBe(true);
  });

  it('cofa tylko ostatni przydział i pozwala ponownie losować', () => {
    const rules: Rule[] = [{ giverId: 'p1', receiverId: 'p0', reason: 'MANUAL' }];
    const initial = makeState(3, rules);
    const first = drawFor(initial, 'p0', () => 0);
    const second = drawFor(first.state, 'p1', () => 0);
    const undone = undoLastDraw(second.state);

    expect(undone.undoneGiverId).toBe('p1');
    expect(undone.state.draws).toEqual([first.draw]);
    expect(undone.state.event).toBe(initial.event);
    expect(undone.state.rules).toBe(initial.rules);
    expect(second.state.draws).toHaveLength(2);
    expect(validCandidates(undone.state, 'p1')).toContain(second.draw.receiverId);
    expect(drawFor(undone.state, 'p1', () => 0).draw).toEqual(second.draw);
  });

  it('bez przydziałów nie zmienia stanu', () => {
    const state = makeState(3);
    const result = undoLastDraw(state);
    expect(result.state).toBe(state);
    expect(result.undoneGiverId).toBeNull();
  });

  it('odrzuca nieznanego uczestnika i błędne wartości RNG', () => {
    const state = makeState(3);
    expect(() => validCandidates(state, 'missing')).toThrow(EngineError);
    expect(() => drawFor(makeState(13), 'p0', () => 0)).toThrow(EngineError);
    for (const value of [-1, 2, 0.5, NaN]) {
      expect(() => drawFor(state, 'p0', () => value)).toThrow(EngineError);
      expect(state.draws).toEqual([]);
    }
  });

  it('odrzuca stan z powtórzonym odbiorcą albo zakazanym przydziałem', () => {
    const duplicate: Draw[] = [
      { giverId: 'p0', receiverId: 'p1', revealCompleted: false },
      { giverId: 'p2', receiverId: 'p1', revealCompleted: false },
    ];
    expect(() => validCandidates(makeState(3, [], duplicate), 'p1')).toThrow(EngineError);

    const duplicateGiver: Draw[] = [
      { giverId: 'p0', receiverId: 'p1', revealCompleted: false },
      { giverId: 'p0', receiverId: 'p2', revealCompleted: false },
    ];
    expect(() => validCandidates(makeState(3, [], duplicateGiver), 'p1')).toThrow(EngineError);

    const rules: Rule[] = [{ giverId: 'p0', receiverId: 'p1', reason: 'MANUAL' }];
    const forbidden: Draw[] = [{ giverId: 'p0', receiverId: 'p1', revealCompleted: false }];
    expect(() => undoLastDraw(makeState(3, rules, forbidden))).toThrow(EngineError);
  });

  it('nie losuje przy sprzecznych regułach', () => {
    const rules: Rule[] = [
      { giverId: 'p1', receiverId: 'p0', reason: 'MANUAL' },
      { giverId: 'p1', receiverId: 'p2', reason: 'MANUAL' },
    ];
    const state = makeState(3, rules);
    const random = vi.fn(() => 0);
    expect(validCandidates(state, 'p0')).toEqual([]);
    expect(() => drawFor(state, 'p0', random)).toThrow(EngineError);
    expect(random).not.toHaveBeenCalled();
  });
});
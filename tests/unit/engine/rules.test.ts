import { describe, expect, it } from 'vitest';
import {
  buildGraph,
  EngineError,
  forbiddenFromLastYear,
  forbiddenFromPairs,
} from '../../../src/engine';
import { makeParticipants } from './fixtures';

describe('Reguły i graf', () => {
  it('tworzy dwa zakazy dla pary', () => {
    expect(forbiddenFromPairs([{ firstId: 'p0', secondId: 'p1' }])).toEqual([
      { giverId: 'p0', receiverId: 'p1', reason: 'COUPLE' },
      { giverId: 'p1', receiverId: 'p0', reason: 'COUPLE' },
    ]);
  });

  it('tworzy wyłącznie jednostronny zakaz z poprzedniego roku', () => {
    const rules = forbiddenFromLastYear([{ giverId: 'p0', receiverId: 'p1' }]);
    expect(rules).toEqual([{ giverId: 'p0', receiverId: 'p1', reason: 'LAST_YEAR' }]);
    const graph = buildGraph(makeParticipants(3), rules);
    expect(graph.get('p0')).toEqual(['p2']);
    expect(graph.get('p1')).toEqual(['p0', 'p2']);
  });

  it('bez reguł wyklucza tylko losowanie siebie', () => {
    const graph = buildGraph(makeParticipants(3), []);
    expect(graph.get('p0')).toEqual(['p1', 'p2']);
    expect(graph.get('p1')).toEqual(['p0', 'p2']);
    expect(graph.get('p2')).toEqual(['p0', 'p1']);
  });

  it('odrzuca parę z jedną osobą i niepoprawne wyniki z poprzedniego roku', () => {
    expect(() => forbiddenFromPairs([{ firstId: 'p0', secondId: 'p0' }])).toThrow(EngineError);
    expect(() => forbiddenFromPairs([{ firstId: '', secondId: 'p1' }])).toThrow(EngineError);
    expect(() => forbiddenFromLastYear([{ giverId: 'p0', receiverId: 'p0' }])).toThrow(EngineError);
    expect(() => forbiddenFromLastYear([
      { giverId: 'p0', receiverId: 'p1' },
      { giverId: 'p2', receiverId: 'p1' },
    ])).toThrow(EngineError);
    expect(() => forbiddenFromLastYear([
      { giverId: 'p0', receiverId: 'p1' },
      { giverId: 'p0', receiverId: 'p2' },
    ])).toThrow(EngineError);
  });

  it('odrzuca nieznanych uczestników i jawny zakaz do siebie', () => {
    const people = makeParticipants(3);
    expect(() => buildGraph(people, [
      { giverId: 'p0', receiverId: 'unknown', reason: 'MANUAL' },
    ])).toThrow(EngineError);
    expect(() => buildGraph(people, [
      { giverId: 'p0', receiverId: 'p0', reason: 'MANUAL' },
    ])).toThrow(EngineError);
    const duplicateIds = people.map((person, index) => index === 1 ? { ...person, id: 'p0' } : person);
    expect(() => buildGraph(duplicateIds, [])).toThrow(EngineError);
  });
});
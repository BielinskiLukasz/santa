import { describe, expect, it } from 'vitest';
import { ceremonyTiming, cycleUndrawn, undrawnIds } from '../../../src/ui/ceremony';

const participants = Array.from({ length: 7 }, (_, index) => ({ id: `p${index}` }));

describe('Ceremonia — wybór losującego', () => {
  it('zwraca tylko osoby, które jeszcze nie losowały', () => {
    expect(undrawnIds(participants, new Set(['p1', 'p3']))).toEqual(['p0', 'p2', 'p4', 'p5', 'p6']);
    expect(undrawnIds(participants, new Set(participants.map((person) => person.id)))).toEqual([]);
  });

  it('przechodzi po kręgu z zawijaniem i pomija wylosowanych', () => {
    const drawn = new Set<string>();
    expect(cycleUndrawn(participants, drawn, null)).toBe('p0');
    expect(cycleUndrawn(participants, drawn, 'p0')).toBe('p1');
    expect(cycleUndrawn(participants, drawn, 'p6')).toBe('p0');
    expect(cycleUndrawn(participants, drawn, 'p0', -1)).toBe('p6');
    drawn.add('p1');
    drawn.add('p2');
    expect(cycleUndrawn(participants, drawn, 'p0')).toBe('p3');
    expect(cycleUndrawn(participants, drawn, 'p3', -1)).toBe('p0');
  });

  it('zwraca null, gdy wszyscy już losowali', () => {
    const drawn = new Set(participants.map((person) => person.id));
    expect(cycleUndrawn(participants, drawn, 'p2')).toBeNull();
    expect(cycleUndrawn(participants, drawn, null)).toBeNull();
  });

  it('skraca czasy ceremonii przy ograniczonym ruchu', () => {
    const full = ceremonyTiming(false);
    const reduced = ceremonyTiming(true);
    expect(full.walkMs).toBeGreaterThanOrEqual(1000);
    expect(reduced.walkMs).toBeLessThan(full.walkMs);
    expect(reduced.envelopeMs).toBeLessThan(full.envelopeMs);
  });
});

import { describe, expect, it } from 'vitest';
import { layout, SCENE_WIDTH } from '../../../src/scene/layout';

describe('layout(n)', () => {
  it('rozmieszcza od 7 do 12 zwierząt w dwóch rzędach bez nakładania', () => {
    for (let count = 7; count <= 12; count += 1) {
      const slots = layout(count);
      expect(slots).toHaveLength(count);
      const back = slots.filter((slot) => slot.row === 'back');
      const front = slots.filter((slot) => slot.row === 'front');
      expect(back.length).toBe(Math.floor(count / 2));
      expect(front.length).toBe(count - back.length);
      expect(back.length).toBeLessThanOrEqual(6);
      expect(front.length).toBeLessThanOrEqual(6);
      for (const slot of slots) {
        expect(slot.x).toBeGreaterThanOrEqual(200);
        expect(slot.x).toBeLessThanOrEqual(SCENE_WIDTH - 200);
      }
      for (const row of [back, front]) {
        const xs = row.map((slot) => slot.x).sort((a, b) => a - b);
        for (let index = 1; index < xs.length; index += 1) {
          expect((xs[index] as number) - (xs[index - 1] as number)).toBeGreaterThanOrEqual(170);
        }
      }
    }
  });

  it('zachowuje symetrię względem ogniska i skalę rzędów z ART-SPEC', () => {
    for (let count = 7; count <= 12; count += 1) {
      const slots = layout(count);
      for (const rowName of ['back', 'front'] as const) {
        const row = slots.filter((slot) => slot.row === rowName);
        const xs = row.map((slot) => slot.x).sort((a, b) => a - b);
        xs.forEach((x, index) => {
          expect(Math.abs(x + (xs[xs.length - 1 - index] as number) - SCENE_WIDTH)).toBeLessThanOrEqual(2);
        });
        for (const slot of row) {
          if (rowName === 'back') {
            expect(slot.y).toBeGreaterThanOrEqual(560);
            expect(slot.y).toBeLessThanOrEqual(620);
            expect(slot.scale).toBe(0.85);
          } else {
            expect(slot.y).toBeGreaterThanOrEqual(720);
            expect(slot.y).toBeLessThanOrEqual(800);
            expect(slot.scale).toBe(1);
          }
        }
      }
    }
  });

  it('jest odporny na wartości spoza zakresu wydarzenia', () => {
    expect(layout(0)).toEqual([]);
    expect(layout(99)).toHaveLength(12);
    expect(layout(5).length).toBe(5);
  });
});

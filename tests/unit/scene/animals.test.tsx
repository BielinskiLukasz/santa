// @vitest-environment jsdom
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import {
  ALL_ANIMALS,
  AnimalFigure,
  CUSTOM_FACE,
  FUR_COLORS,
  resolveScarves,
  scarfFor,
} from '../../../src/scene/animals';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(node: ReactNode): { container: HTMLDivElement; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function renderFigure(kind: string, mood: 'cheerful' | 'holding-envelope' | 'dozing' = 'cheerful') {
  return render(
    <svg viewBox="0 0 120 132">
      <AnimalFigure kind={kind} scarf={scarfFor(kind)} mood={mood} />
    </svg>,
  );
}

describe('Rejestr zwierząt', () => {
  it('zawiera 16 gatunków ze spójnymi kolorami futra', () => {
    expect(ALL_ANIMALS).toHaveLength(16);
    expect(new Set(ALL_ANIMALS.map((animal) => animal.id)).size).toBe(16);
    for (const animal of ALL_ANIMALS) {
      expect(FUR_COLORS[animal.id]).toMatch(/^#[0-9a-f]{6}$/);
      expect(animal.name.length).toBeGreaterThan(0);
    }
    for (const kind of CUSTOM_FACE) {
      expect(ALL_ANIMALS.some((animal) => animal.id === kind)).toBe(true);
    }
  });

  it('przydziela szaliki tak, by sąsiedzi w kręgu się różnili', () => {
    const ids = Array.from({ length: 12 }, (_, index) => `p${index}`);
    const scarves = resolveScarves(ids);
    expect(scarves).toHaveLength(12);
    scarves.forEach((color, index) => {
      const next = scarves[(index + 1) % scarves.length] as string;
      expect(color).not.toBe(next);
    });
    expect(scarfFor('lisek')).toBe(scarfFor('lisek'));
  });

  it('renderuje każdy gatunek, a nastrój holding-envelope unosi kopertę', () => {
    for (const animal of ALL_ANIMALS) {
      const view = renderFigure(animal.id, 'holding-envelope');
      expect(view.container.querySelector(`[data-kind="${animal.id}"]`)).not.toBeNull();
      expect(view.container.querySelector('[data-testid="held-envelope"]')).not.toBeNull();
      view.unmount();
    }
    const calm = renderFigure('mis', 'cheerful');
    expect(calm.container.querySelector('[data-testid="held-envelope"]')).toBeNull();
    calm.unmount();
  });

  it('stosuje własną twarz tylko dla gatunków z CUSTOM_FACE', () => {
    const owl = renderFigure('sowka');
    expect(owl.container.querySelector('[data-face="custom"]')).not.toBeNull();
    owl.unmount();
    const bear = renderFigure('mis', 'dozing');
    expect(bear.container.querySelector('[data-face="common"]')).not.toBeNull();
    bear.unmount();
  });
});

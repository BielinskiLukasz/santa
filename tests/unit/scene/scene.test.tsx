// @vitest-environment jsdom
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { ALL_ANIMALS } from '../../../src/scene/animals';
import { Scene } from '../../../src/scene/Scene';
import type { SceneParticipant } from '../../../src/scene/Scene';

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

function participants(count: number): SceneParticipant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    name: index === 0 ? 'Łucja Żmijewska' : `Osoba ${index}`,
    animal: ALL_ANIMALS[index % ALL_ANIMALS.length]?.id ?? 'mis',
    drawn: index < 3,
  }));
}

describe('Scena polany', () => {
  it('renderuje 12 zwierząt z tabliczkami, odznakami i tablicą budżetu', () => {
    const view = render(<Scene participants={participants(12)} budgetText="100 zł" lightsOn={false} />);
    expect(view.container.querySelectorAll('[data-animal-slot]')).toHaveLength(12);
    expect(view.container.querySelectorAll('[data-badge="drawn"]')).toHaveLength(3);
    expect(view.container.querySelectorAll('[data-badge="empty"]')).toHaveLength(9);
    expect(view.container.querySelectorAll('[data-nameplate]')).toHaveLength(12);
    expect(view.container.textContent).toContain('Łucja Żmijewska');
    const board = view.container.querySelector('[data-budget-board]');
    expect(board?.textContent).toContain('100 zł');
    expect(view.container.querySelector('[data-garland="off"]')).not.toBeNull();
    expect(view.container.querySelector('[data-scene]')?.getAttribute('aria-label')).toContain('12 zwierząt');
    view.unmount();
  });

  it('zapala girlandę po zakończeniu i pokazuje kopertę w łapkach wskazanego zwierzątka', () => {
    const view = render(
      <Scene participants={participants(7)} budgetText={null} lightsOn holdingId="p2" />,
    );
    expect(view.container.querySelector('[data-garland="on"]')).not.toBeNull();
    const holder = view.container.querySelector('[data-participant="p2"]');
    expect(holder?.querySelector('[data-mood="holding-envelope"]')).not.toBeNull();
    expect(view.container.querySelector('[data-budget-board]')?.textContent).toContain('do ustalenia');
    view.unmount();
  });
});

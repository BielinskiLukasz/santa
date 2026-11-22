// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoverOverlay, REVEAL_AUTO_HIDE_MS } from '../../../src/ui/CoverOverlay';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof window.PointerEvent === 'undefined') {
  (window as unknown as { PointerEvent: unknown }).PointerEvent = class extends MouseEvent {
    pointerId = 1;
  };
}

const cleanups: (() => void)[] = [];

function render(onClose: () => void): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <CoverOverlay
        giverName="Losująca Osoba"
        giverAnimal="lisek"
        receiverName="Sekretna Osoba"
        receiverAnimal="mis"
        budgetText="100 zł"
        onClose={onClose}
      />,
    ),
  );
  cleanups.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return container;
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((entry) => entry.textContent?.includes(text));
  if (!button) throw new Error(`Brak przycisku: ${text}`);
  return button;
}

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.useRealTimers();
});

describe('Tryb „zasłoń"', () => {
  it('pokazuje wynik wyłącznie podczas przytrzymania przycisku', () => {
    const container = render(() => {});
    expect(container.textContent).not.toContain('Sekretna Osoba');
    act(() => buttonByText(container, 'Jestem gotowy/a').click());
    expect(container.textContent).not.toContain('Sekretna Osoba');

    const hold = container.querySelector('[data-hold-button]') as HTMLButtonElement;
    act(() => hold.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true })));
    expect(container.textContent).toContain('Sekretna Osoba');
    expect(container.querySelector('[data-reveal]')?.textContent).toContain('100 zł');

    act(() => hold.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true })));
    expect(container.textContent).not.toContain('Sekretna Osoba');

    act(() => hold.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    expect(container.textContent).toContain('Sekretna Osoba');
    act(() => hold.dispatchEvent(new window.KeyboardEvent('keyup', { key: ' ', bubbles: true })));
    expect(container.textContent).not.toContain('Sekretna Osoba');
  });

  it('auto-ukrywa wynik po 10 sekundach ciągłego przytrzymania', () => {
    vi.useFakeTimers();
    const container = render(() => {});
    act(() => buttonByText(container, 'Jestem gotowy/a').click());
    const hold = container.querySelector('[data-hold-button]') as HTMLButtonElement;
    act(() => hold.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true })));
    expect(container.textContent).toContain('Sekretna Osoba');
    act(() => vi.advanceTimersByTime(REVEAL_AUTO_HIDE_MS));
    expect(container.textContent).not.toContain('Sekretna Osoba');
    // The session itself is still alive: holding again reveals once more.
    act(() => hold.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true })));
    expect(container.textContent).toContain('Sekretna Osoba');
  });

  it('zamknięcie i utrata fokusu okna kończą sesję dokładnie raz', () => {
    const onClose = vi.fn();
    const container = render(onClose);
    act(() => buttonByText(container, 'Zamknij').click());
    expect(onClose).toHaveBeenCalledTimes(1);

    const secondClose = vi.fn();
    render(secondClose);
    act(() => window.dispatchEvent(new window.Event('blur')));
    expect(secondClose).toHaveBeenCalledTimes(1);
  });
});

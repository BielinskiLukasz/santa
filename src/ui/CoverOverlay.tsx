import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { pl } from '../i18n/pl';
import { AnimalAvatar } from '../scene/animals';
import { GhostButton, PrimaryButton } from './widgets';

// Seconds of continuous holding after which the result hides itself (SECURITY-SPEC §6).
export const REVEAL_AUTO_HIDE_MS = 10_000;

/**
 * "Zasłoń" overlay. The receiver's name is rendered only while the operator holds the
 * button; releasing, auto-hide, focus loss or closing ends (or pauses) the reveal.
 * Ending the session is reported through onClose exactly once per session end action.
 */
export function CoverOverlay({
  giverName,
  giverAnimal,
  receiverName,
  receiverAnimal,
  budgetText,
  onReady,
  onClose,
}: {
  giverName: string;
  giverAnimal: string;
  receiverName: string;
  receiverAnimal: string;
  budgetText: string | null;
  /** Fired when the participant confirms readiness (seal "plum" moment). */
  onReady?: () => void;
  onClose: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [holding, setHolding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const closedRef = useRef(false);

  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    setHolding(false);
    onClose();
  }, [onClose]);

  const stopHolding = useCallback(() => {
    setHolding(false);
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const startHolding = useCallback(() => {
    setHolding(true);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setHolding(false), REVEAL_AUTO_HIDE_MS);
  }, []);

  useEffect(() => {
    containerRef.current?.focus();
    const onWindowBlur = () => close();
    const onVisibility = () => {
      if (document.hidden) close();
    };
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, [close ]);

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={pl.ceremony.coverTitle(giverName)}
      className="fixed inset-0 z-40 grid place-items-center bg-night/95 p-4 outline-none"
      onBlur={(event) => {
        // Focus leaving the overlay entirely ends the session (SECURITY-SPEC §6).
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
      }}
    >
      <div className="w-full max-w-lg animate-fade-up rounded-3xl bg-paper p-7 text-center text-ink shadow-2xl sm:p-9">
        {!ready ? (
          <>
            <AnimalAvatar kind={giverAnimal} size={104} />
            <h2 className="mt-4 font-display text-3xl font-semibold leading-snug">
              {pl.ceremony.coverTitle(giverName)}
            </h2>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <PrimaryButton
                onClick={() => {
                  setReady(true);
                  onReady?.();
                }}
              >
                {pl.ceremony.ready}
              </PrimaryButton>
              <GhostButton onClick={close}>{pl.ceremony.close}</GhostButton>
            </div>
          </>
        ) : (
          <>
            <div className="flex min-h-56 flex-col items-center justify-center" aria-live="off">
              {holding ? (
                <div data-reveal className="animate-fade-up">
                  <AnimalAvatar kind={receiverAnimal} size={120} />
                  <p className="mt-3 text-sm font-bold uppercase tracking-wider text-mist">{pl.ceremony.forWhom}</p>
                  <p className="mt-1 font-display text-4xl font-semibold">{receiverName}</p>
                  {budgetText ? (
                    <p className="mt-2 font-display text-xl text-forest">{pl.ceremony.budgetLine(budgetText)}</p>
                  ) : null}
                </div>
              ) : (
                <div className="opacity-80">
                  <span className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-forest/10 text-forest">
                    <EyeOff size={44} aria-hidden="true" />
                  </span>
                  <p className="mt-3 max-w-xs text-sm leading-relaxed text-mist">{pl.ceremony.holdHint}</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-wrap items-stretch justify-center gap-3">
              <button
                type="button"
                data-hold-button
                className={`inline-flex min-h-14 select-none items-center justify-center gap-2 rounded-full px-7 text-base font-bold text-cream shadow-lg transition touch-none ${
                  holding ? 'bg-clay' : 'bg-forest hover:bg-pine'
                }`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  startHolding();
                }}
                onPointerUp={stopHolding}
                onPointerCancel={stopHolding}
                onLostPointerCapture={stopHolding}
                onContextMenu={(event) => event.preventDefault()}
                onKeyDown={(event) => {
                  if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
                    event.preventDefault();
                    startHolding();
                  }
                }}
                onKeyUp={(event) => {
                  if (event.key === ' ' || event.key === 'Enter') stopHolding();
                }}
              >
                <Eye size={20} aria-hidden="true" /> {pl.ceremony.hold}
              </button>
              <GhostButton onClick={close}>
                <X size={18} aria-hidden="true" /> {pl.ceremony.close}
              </GhostButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

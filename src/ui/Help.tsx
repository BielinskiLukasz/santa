import { useEffect, useRef } from 'react';
import { CircleHelp, X } from 'lucide-react';
import { pl } from '../i18n/pl';

export function HelpOverlay({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-night/80 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        className="my-8 w-full max-w-2xl animate-fade-up rounded-3xl bg-paper p-6 text-ink shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="help-title" className="flex items-center gap-2 font-display text-2xl font-semibold">
            <CircleHelp size={24} aria-hidden="true" /> {pl.help.title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={pl.common.close}
            className="rounded-full p-1.5 text-ink/70 transition hover:bg-forest/10"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-forest">{pl.help.controlsTitle}</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-forest/20 text-mist">
                <th scope="col" className="py-2 pr-3 font-semibold">{pl.help.actionHeader}</th>
                <th scope="col" className="py-2 pr-3 font-semibold">{pl.help.mouseHeader}</th>
                <th scope="col" className="py-2 font-semibold">{pl.help.keyboardHeader}</th>
              </tr>
            </thead>
            <tbody>
              {pl.help.controls.map(([action, mouse, keyboard]) => (
                <tr key={action} className="border-b border-forest/10 align-top">
                  <th scope="row" className="py-2 pr-3 font-semibold">{action}</th>
                  <td className="py-2 pr-3">{mouse}</td>
                  <td className="py-2">{keyboard}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-forest">{pl.help.stepsTitle}</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
          {pl.help.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-forest">{pl.help.privacyTitle}</h3>
        <p className="mt-2 text-sm leading-relaxed text-mist">{pl.help.privacy}</p>

        <div className="mt-7 text-right">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-full bg-forest px-5 text-sm font-bold text-cream transition hover:bg-pine"
          >
            {pl.common.close}
          </button>
        </div>
      </div>
    </div>
  );
}

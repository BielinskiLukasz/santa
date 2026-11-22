import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Lock, Mail, PartyPopper, Settings } from 'lucide-react';
import { validateBudget } from '../engine';
import type { AppAction, AppState } from '../state';
import { pl } from '../i18n/pl';
import { Scene } from '../scene/Scene';
import { errorText } from './controller';
import { Field, GhostButton, MotionToggle, PrimaryButton, inputClass } from './widgets';

export function formatAmount(amount: number, currency: string): string {
  return currency === 'PLN' ? `${amount} zł` : `${amount} ${currency}`;
}

type Dispatch = (action: AppAction) => Promise<AppState>;

function BudgetPanel({ state, busy, onDispatch }: { state: AppState; busy: boolean; onDispatch: Dispatch }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const saved = state.event.budget;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const value = Number(amount);
    const result = validateBudget(Number.isSafeInteger(value) ? value : Number.NaN, state.budgetRange);
    if (!result.ok) {
      setError(
        result.code === 'OUT_OF_RANGE'
          ? pl.event.budgetRange(state.budgetRange.min, state.budgetRange.max, state.event.currency)
          : pl.event.budgetInvalid,
      );
      return;
    }
    try {
      await onDispatch({ type: 'SET_BUDGET', amount: result.value });
      setAmount('');
    } catch (cause) {
      setError(errorText(cause));
    }
  };

  const startDrawing = async () => {
    try {
      await onDispatch({ type: 'START_DRAWING' });
    } catch (cause) {
      setError(errorText(cause));
    }
  };

  return (
    <section className="w-full max-w-xl animate-fade-up rounded-3xl bg-paper p-7 text-ink shadow-2xl sm:p-8">
      <h1 className="font-display text-3xl font-semibold">{pl.event.budgetTitle}</h1>
      <p className="mt-2 text-sm leading-relaxed text-mist">{pl.event.budgetIntro}</p>
      {saved !== null ? (
        <div className="mt-6 grid gap-5">
          <p className="rounded-2xl bg-forest/10 px-4 py-3 font-display text-2xl font-semibold text-forest">
            {pl.event.budgetSaved(formatAmount(saved, state.event.currency))}
          </p>
          {error ? <p role="alert" className="text-sm font-semibold text-seal">{error}</p> : null}
          <div className="flex flex-wrap gap-3">
            <PrimaryButton busy={busy} onClick={startDrawing}>{pl.event.startDrawing}</PrimaryButton>
          </div>
          <form onSubmit={submit} className="grid gap-3 border-t border-forest/15 pt-5">
            <Field label={pl.event.budgetChange}>
              <input
                inputMode="numeric"
                className={inputClass}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={String(saved)}
              />
            </Field>
            <div>
              <GhostButton type="submit">{pl.event.budgetSubmit}</GhostButton>
            </div>
          </form>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 grid gap-4">
          <Field label={pl.event.budgetLabel}>
            <input
              inputMode="numeric"
              autoFocus
              className={inputClass}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={pl.event.budgetRange(state.budgetRange.min, state.budgetRange.max, state.event.currency)}
            />
          </Field>
          <p className="text-xs text-mist">
            {pl.event.budgetRange(state.budgetRange.min, state.budgetRange.max, state.event.currency)}
          </p>
          {error ? <p role="alert" className="text-sm font-semibold text-seal">{error}</p> : null}
          <div>
            <PrimaryButton type="submit" busy={busy} disabled={amount.trim().length === 0}>
              {pl.event.budgetSubmit}
            </PrimaryButton>
          </div>
        </form>
      )}
    </section>
  );
}

export function EventScreen({
  state,
  busy,
  onOpenAdmin,
  onDispatch,
  onLock,
}: {
  state: AppState;
  busy: boolean;
  onOpenAdmin: () => void;
  onDispatch: Dispatch;
  onLock: () => void;
}) {
  const phase = state.event.phase;
  const drawnCount = state.draws.length;

  const sceneParticipants = useMemo(() => {
    const drawnIds = new Set(state.draws.map((draw) => draw.giverId));
    return state.participants.map((person) => ({
      id: person.id,
      name: person.name,
      animal: person.animal,
      drawn: drawnIds.has(person.id),
    }));
  }, [state.participants, state.draws]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-night text-cream">
      <div className="absolute inset-0" aria-hidden={phase === 'DRAWING' || phase === 'DONE' ? undefined : true}>
        <Scene
          participants={sceneParticipants}
          budgetText={state.event.budget !== null ? formatAmount(state.event.budget, state.event.currency) : null}
          lightsOn={phase === 'DONE'}
          className="h-full w-full"
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/><feColorMatrix type="saturate" values="0"/></filter><rect width="160" height="160" filter="url(%23n)" opacity="0.6"/></svg>\')',
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-night/70 to-transparent" />

      <header className="relative z-10 flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <span className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-cream/60 bg-night/30">
            <Mail size={18} aria-hidden="true" />
          </span>
          <span>
            <span className="block font-display text-lg font-semibold leading-none">{pl.event.brand}</span>
            <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.18em] opacity-70">
              {pl.event.tagline} · {state.event.year}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full border border-cream/40 bg-night/30 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            {pl.event.phaseNames[phase] ?? phase}
          </span>
          <button
            type="button"
            onClick={onOpenAdmin}
            aria-label={pl.event.openAdmin}
            title={pl.event.openAdmin}
            className="grid h-10 w-10 place-items-center rounded-full border border-cream/40 bg-night/30 transition hover:bg-cream/10"
          >
            <Settings size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onLock}
            aria-label={pl.common.lock}
            title={pl.common.lock}
            className="grid h-10 w-10 place-items-center rounded-full border border-cream/40 bg-night/30 transition hover:bg-cream/10"
          >
            <Lock size={18} aria-hidden="true" />
          </button>
        </span>
      </header>

      <main className="relative z-10 flex flex-1 items-start px-4 pb-10 pt-2 sm:px-8">
        {phase === 'SETUP' ? (
          <section className="w-full max-w-xl animate-fade-up rounded-3xl bg-paper p-7 text-ink shadow-2xl sm:p-8">
            <h1 className="font-display text-3xl font-semibold">{pl.event.setupTitle}</h1>
            <p className="mt-2 text-sm leading-relaxed text-mist">{pl.event.setupBody}</p>
            <div className="mt-6">
              <PrimaryButton onClick={onOpenAdmin}>{pl.event.setupAction}</PrimaryButton>
            </div>
          </section>
        ) : null}

        {phase === 'BUDGET' ? <BudgetPanel state={state} busy={busy} onDispatch={onDispatch} /> : null}

        {phase === 'DRAWING' ? (
          <section className="w-full max-w-md animate-fade-up rounded-3xl bg-paper/95 p-6 text-ink shadow-2xl">
            <h1 className="font-display text-3xl font-semibold">{pl.event.drawingTitle}</h1>
            <p className="mt-3 font-display text-xl font-semibold text-forest">
              {pl.event.drawingProgress(drawnCount, state.participants.length)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-mist">{pl.event.drawingBody}</p>
          </section>
        ) : null}

        {phase === 'DONE' ? (
          <section className="w-full max-w-md animate-fade-up rounded-3xl bg-paper/95 p-6 text-ink shadow-2xl">
            <PartyPopper className="text-clay" size={34} aria-hidden="true" />
            <h1 className="mt-2 font-display text-3xl font-semibold">{pl.event.doneTitle}</h1>
            <p className="mt-2 text-sm leading-relaxed text-mist">{pl.event.doneBody}</p>
            {state.event.budget !== null ? (
              <p className="mt-3 font-display text-xl font-semibold text-forest">
                {pl.event.budgetSaved(formatAmount(state.event.budget, state.event.currency))}
              </p>
            ) : null}
          </section>
        ) : null}
      </main>

      <footer className="relative z-10 flex items-center justify-between px-5 pb-5 text-cream sm:px-8">
        <span className="text-xs opacity-80">{pl.gate.neverOnEventScreen}</span>
        <MotionToggle />
      </footer>
    </div>
  );
}

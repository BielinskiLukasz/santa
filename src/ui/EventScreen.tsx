import { useState } from 'react';
import type { FormEvent } from 'react';
import { BadgeCheck, Lock, Mail, PartyPopper, Settings } from 'lucide-react';
import { validateBudget } from '../engine';
import type { AppAction, AppState } from '../state';
import { pl } from '../i18n/pl';
import { animalName } from './animals';
import { errorText } from './controller';
import { AnimalDisc, Field, GhostButton, MotionToggle, PrimaryButton, inputClass } from './widgets';

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
    <section className="mx-auto w-full max-w-xl animate-fade-up rounded-3xl bg-paper p-7 text-ink shadow-2xl sm:p-8">
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

function ParticipantRows({ state }: { state: AppState }) {
  const drawnIds = new Set(state.draws.map((draw) => draw.giverId));
  return (
    <ul className="grid gap-2">
      {state.participants.map((person) => {
        const drawn = drawnIds.has(person.id);
        return (
          <li
            key={person.id}
            className="flex items-center gap-3 rounded-2xl bg-parchment px-4 py-2.5 ring-1 ring-black/5"
          >
            <AnimalDisc animalId={person.animal} />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">{person.name}</span>
              <span className="block text-xs text-mist">{animalName(person.animal)}</span>
            </span>
            <span
              className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                drawn ? 'bg-forest text-cream' : 'bg-forest/10 text-forest'
              }`}
            >
              {drawn ? <BadgeCheck size={14} aria-hidden="true" /> : null}
              {drawn ? pl.event.drawnBadge : pl.event.waitingBadge}
            </span>
          </li>
        );
      })}
    </ul>
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

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-night text-cream">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="star absolute left-[10%] top-[14%] h-1.5 w-1.5 rounded-full bg-cream" />
        <span className="star absolute left-[84%] top-[20%] h-1 w-1 rounded-full bg-cream" style={{ animationDelay: '-2s' }} />
        <span className="star absolute left-[58%] top-[8%] h-1.5 w-1.5 rounded-full bg-gold" style={{ animationDelay: '-1s' }} />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-pine to-transparent" />
      </div>

      <header className="relative flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <span className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-cream/60">
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
          <span className="rounded-full border border-cream/40 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            {pl.event.phaseNames[phase] ?? phase}
          </span>
          <button
            type="button"
            onClick={onOpenAdmin}
            aria-label={pl.event.openAdmin}
            title={pl.event.openAdmin}
            className="grid h-10 w-10 place-items-center rounded-full border border-cream/40 transition hover:bg-cream/10"
          >
            <Settings size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onLock}
            aria-label={pl.common.lock}
            title={pl.common.lock}
            className="grid h-10 w-10 place-items-center rounded-full border border-cream/40 transition hover:bg-cream/10"
          >
            <Lock size={18} aria-hidden="true" />
          </button>
        </span>
      </header>

      <main className="relative flex-1 px-4 pb-10 pt-4 sm:px-8">
        {phase === 'SETUP' ? (
          <section className="mx-auto w-full max-w-xl animate-fade-up rounded-3xl bg-paper p-7 text-ink shadow-2xl sm:p-8">
            <h1 className="font-display text-3xl font-semibold">{pl.event.setupTitle}</h1>
            <p className="mt-2 text-sm leading-relaxed text-mist">{pl.event.setupBody}</p>
            <div className="mt-6">
              <PrimaryButton onClick={onOpenAdmin}>{pl.event.setupAction}</PrimaryButton>
            </div>
          </section>
        ) : null}

        {phase === 'BUDGET' ? <BudgetPanel state={state} busy={busy} onDispatch={onDispatch} /> : null}

        {phase === 'DRAWING' ? (
          <section className="mx-auto w-full max-w-2xl animate-fade-up rounded-3xl bg-paper p-7 text-ink shadow-2xl sm:p-8">
            <h1 className="font-display text-3xl font-semibold">{pl.event.drawingTitle}</h1>
            <p className="mt-2 text-sm leading-relaxed text-mist">{pl.event.drawingBody}</p>
            <p className="mt-4 font-display text-xl font-semibold text-forest">
              {pl.event.drawingProgress(drawnCount, state.participants.length)}
            </p>
            <div className="mt-4">
              <ParticipantRows state={state} />
            </div>
          </section>
        ) : null}

        {phase === 'DONE' ? (
          <section className="mx-auto w-full max-w-2xl animate-fade-up rounded-3xl bg-paper p-7 text-center text-ink shadow-2xl sm:p-8">
            <PartyPopper className="mx-auto text-clay" size={40} aria-hidden="true" />
            <h1 className="mt-3 font-display text-3xl font-semibold">{pl.event.doneTitle}</h1>
            <p className="mt-2 text-sm leading-relaxed text-mist">{pl.event.doneBody}</p>
            {state.event.budget !== null ? (
              <p className="mt-4 font-display text-xl font-semibold text-forest">
                {pl.event.budgetSaved(formatAmount(state.event.budget, state.event.currency))}
              </p>
            ) : null}
            <div className="mt-6 text-left">
              <ParticipantRows state={state} />
            </div>
          </section>
        ) : null}
      </main>

      <footer className="relative flex items-center justify-between px-5 pb-5 text-cream sm:px-8">
        <span className="text-xs opacity-70">{pl.gate.neverOnEventScreen}</span>
        <MotionToggle />
      </footer>
    </div>
  );
}

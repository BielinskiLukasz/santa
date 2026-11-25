import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CircleHelp, Lock, Mail, PartyPopper, Settings, Volume2, VolumeX } from 'lucide-react';
import { validateBudget } from '../engine';
import type { Draw } from '../engine';
import type { AppAction, AppState } from '../state';
import { pl } from '../i18n/pl';
import { animalName } from './animals';
import { ceremonyTiming, cycleUndrawn } from './ceremony';
import { CoverOverlay } from './CoverOverlay';
import { errorText } from './controller';
import type { SoundEffects } from './controller';
import { Scene } from '../scene/Scene';
import { Field, GhostButton, MotionToggle, PrimaryButton, inputClass } from './widgets';

export function formatAmount(amount: number, currency: string): string {
  return currency === 'PLN' ? `${amount} zł` : `${amount} ${currency}`;
}

type Dispatch = (action: AppAction) => Promise<AppState>;
type Notify = (kind: 'info' | 'error', text: string) => void;
type CeremonyStep = 'pick' | 'walk' | 'envelope' | 'cover' | 'return';

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
    <section className="pointer-events-auto w-full max-w-xl animate-fade-up rounded-3xl bg-paper p-7 text-ink shadow-2xl sm:p-8">
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
  suspended,
  muted,
  onToggleMute,
  soundEffects,
  onOpenAdmin,
  onHelp,
  onDispatch,
  onDraw,
  onLock,
  onFinish,
  showNotice,
}: {
  state: AppState;
  busy: boolean;
  suspended: boolean;
  muted: boolean;
  onToggleMute: () => void;
  soundEffects: SoundEffects;
  onOpenAdmin: () => void;
  onHelp: () => void;
  onDispatch: Dispatch;
  onDraw: (giverId: string) => Promise<Draw>;
  onLock: () => void;
  onFinish: () => void;
  showNotice: Notify;
}) {
  const phase = state.event.phase;
  const drawnCount = state.draws.length;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [step, setStep] = useState<CeremonyStep>('pick');
  const [actorId, setActorId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ giverId: string; receiverId: string } | null>(null);
  const timersRef = useRef<number[]>([]);
  const finishingRef = useRef(false);
  const timing = useMemo(
    () => ceremonyTiming(window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    [],
  );

  const drawnIds = useMemo(() => new Set(state.draws.map((draw) => draw.giverId)), [state.draws]);
  const selected = state.participants.find((person) => person.id === selectedId) ?? null;
  const ceremonyBusy = step !== 'pick';

  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  // Leaving the drawing phase resets the ceremony to a clean slate.
  useEffect(() => {
    if (phase !== 'DRAWING') {
      setStep('pick');
      setActorId(null);
      setSelectedId(null);
      setPending(null);
      finishingRef.current = false;
    }
  }, [phase]);

  // The finale bell rings exactly once, when the last reveal completes.
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    if (prevPhaseRef.current !== 'DONE' && phase === 'DONE') soundEffects.bell();
    prevPhaseRef.current = phase;
  }, [phase, soundEffects]);

  const select = useCallback(
    (participantId: string) => {
      if (suspended || step !== 'pick' || drawnIds.has(participantId)) return;
      setSelectedId(participantId);
    },
    [drawnIds, step, suspended],
  );

  useEffect(() => {
    if (phase !== 'DRAWING' || suspended) return;
    const onKey = (event: KeyboardEvent) => {
      if (step !== 'pick') return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      ) {
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedId((current) => cycleUndrawn(state.participants, drawnIds, current, 1));
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedId((current) => cycleUndrawn(state.participants, drawnIds, current, -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawnIds, phase, state.participants, step, suspended]);

  const startDraw = async () => {
    if (suspended || step !== 'pick') return;
    if (selectedId === null) {
      setSelectedId(cycleUndrawn(state.participants, drawnIds, null, 1));
      return;
    }
    const giverId = selectedId;
    setStep('walk');
    setActorId(giverId);
    let draw: Draw;
    try {
      // The assignment is encrypted and persisted before any reveal can happen.
      draw = await onDraw(giverId);
    } catch {
      setActorId(null);
      setStep('pick');
      showNotice('error', pl.ceremony.drawFailed);
      return;
    }
    setPending({ giverId, receiverId: draw.receiverId });
    later(() => {
      setStep('envelope');
      soundEffects.rustle();
    }, timing.walkMs);
    later(() => setStep('cover'), timing.walkMs + timing.envelopeMs);
  };

  const finishReveal = useCallback(async () => {
    if (finishingRef.current || pending === null) return;
    finishingRef.current = true;
    try {
      await onDispatch({ type: 'COMPLETE_REVEAL', giverId: pending.giverId });
      showNotice('info', pl.ceremony.secretKept);
    } catch (cause) {
      showNotice('error', errorText(cause));
    }
    setStep('return');
    setActorId(null);
    later(() => {
      setPending(null);
      setSelectedId(null);
      setStep('pick');
      finishingRef.current = false;
    }, timing.returnMs);
  }, [later, onDispatch, pending, showNotice, timing.returnMs]);

  const sceneParticipants = useMemo(
    () =>
      state.participants.map((person) => ({
        id: person.id,
        name: person.name,
        animal: person.animal,
        drawn: drawnIds.has(person.id),
      })),
    [drawnIds, state.participants],
  );

  const pendingGiver = pending ? state.participants.find((person) => person.id === pending.giverId) : undefined;
  const pendingReceiver = pending
    ? state.participants.find((person) => person.id === pending.receiverId)
    : undefined;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-night text-cream">
      <div className="absolute inset-0" aria-hidden={phase === 'DRAWING' || phase === 'DONE' ? undefined : true}>
        <Scene
          participants={sceneParticipants}
          budgetText={state.event.budget !== null ? formatAmount(state.event.budget, state.event.currency) : null}
          lightsOn={phase === 'DONE'}
          selectedId={step === 'pick' ? selectedId : null}
          actorId={actorId}
          hatEnvelope={step === 'envelope'}
          moods={actorId !== null && step !== 'walk' && step !== 'pick' ? { [actorId]: 'holding-envelope' } : undefined}
          onSelect={phase === 'DRAWING' ? select : undefined}
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
            onClick={onToggleMute}
            aria-label={muted ? pl.common.unmute : pl.common.mute}
            aria-pressed={muted}
            title={muted ? pl.common.unmute : pl.common.mute}
            className="grid h-10 w-10 place-items-center rounded-full border border-cream/40 bg-night/30 transition hover:bg-cream/10"
          >
            {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={onHelp}
            aria-label={pl.event.helpButton}
            title={pl.event.helpButton}
            className="grid h-10 w-10 place-items-center rounded-full border border-cream/40 bg-night/30 transition hover:bg-cream/10"
          >
            <CircleHelp size={18} aria-hidden="true" />
          </button>
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

      <main className="pointer-events-none relative z-10 flex flex-1 items-start px-4 pb-10 pt-2 sm:px-8">
        {phase === 'SETUP' ? (
          <section className="pointer-events-auto w-full max-w-xl animate-fade-up rounded-3xl bg-paper p-7 text-ink shadow-2xl sm:p-8">
            <h1 className="font-display text-3xl font-semibold">{pl.event.setupTitle}</h1>
            <p className="mt-2 text-sm leading-relaxed text-mist">{pl.event.setupBody}</p>
            <div className="mt-6">
              <PrimaryButton onClick={onOpenAdmin}>{pl.event.setupAction}</PrimaryButton>
            </div>
          </section>
        ) : null}

        {phase === 'BUDGET' ? <BudgetPanel state={state} busy={busy} onDispatch={onDispatch} /> : null}

        {phase === 'DRAWING' ? (
          <section className="pointer-events-auto w-full max-w-md animate-fade-up rounded-3xl bg-paper/95 p-6 text-ink shadow-2xl">
            <h1 className="font-display text-3xl font-semibold">{pl.event.drawingTitle}</h1>
            <p className="mt-3 font-display text-xl font-semibold text-forest">
              {pl.event.drawingProgress(drawnCount, state.participants.length)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-mist">{pl.event.drawingBody}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <PrimaryButton busy={busy && step === 'pick'} disabled={suspended || ceremonyBusy} onClick={startDraw}>
                {step !== 'pick'
                  ? pl.event.drawingNow
                  : selected
                    ? pl.event.drawFor(animalName(selected.animal))
                    : pl.event.pickPrompt}
              </PrimaryButton>
              <GhostButton
                disabled={suspended || ceremonyBusy}
                onClick={() => setSelectedId(cycleUndrawn(state.participants, drawnIds, selectedId, 1))}
              >
                {pl.event.nextInCircle}
              </GhostButton>
            </div>
          </section>
        ) : null}

        {phase === 'DONE' ? (
          <section className="pointer-events-auto w-full max-w-md animate-fade-up rounded-3xl bg-paper/95 p-6 text-ink shadow-2xl">
            <PartyPopper className="text-clay" size={34} aria-hidden="true" />
            <h1 className="mt-2 font-display text-3xl font-semibold">{pl.event.doneTitle}</h1>
            <p className="mt-2 text-sm leading-relaxed text-mist">{pl.event.doneBody}</p>
            {state.event.budget !== null ? (
              <p className="mt-3 font-display text-xl font-semibold text-forest">
                {pl.event.budgetSaved(formatAmount(state.event.budget, state.event.currency))}
              </p>
            ) : null}
            <div className="mt-5">
              <PrimaryButton onClick={onFinish}>{pl.event.finish}</PrimaryButton>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="relative z-10 flex items-center justify-between px-5 pb-5 text-cream sm:px-8">
        <span className="text-xs opacity-80">{pl.gate.neverOnEventScreen}</span>
        <MotionToggle />
      </footer>

      {step === 'cover' && pendingGiver && pendingReceiver ? (
        <CoverOverlay
          giverName={pendingGiver.name}
          giverAnimal={pendingGiver.animal}
          receiverName={pendingReceiver.name}
          receiverAnimal={pendingReceiver.animal}
          budgetText={state.event.budget !== null ? formatAmount(state.event.budget, state.event.currency) : null}
          onReady={soundEffects.seal}
          onClose={finishReveal}
        />
      ) : null}
    </div>
  );
}
